import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { buildInstallments } from "@shared/domain/installments";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { randomCpf } from "../../../../../test/documentFixtures";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/purchases/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

/** Data de negócio de hoje deslocada em `days` dias ("YYYY-MM-DD"). */
const addDays = (days: number, from = todayInBusinessTz()) => {
  const d = new Date(`${from}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

type Item = {
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  freight?: number;
  tax?: number;
};

describe("Pedidos de compra (/purchases)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  let supplierId: string;
  let otherSupplierId: string;
  let v1: string;
  let v2: string;
  const variantCleanups: (() => Promise<void>)[] = [];
  const supplierIds: string[] = [];
  const purchaseIds: string[] = [];
  const tag = () => `tx-test-${randomUUID()}`;

  const call = (method: "GET" | "POST", url: string, user: TestUser, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${user.token}` }, payload });

  const createPurchase = async (body: object, user = admin) => {
    const res = await call("POST", "/purchases", user, body);
    const id = res.json()?.data?.id;
    if (id) purchaseIds.push(id);
    return res;
  };

  const body = (items: Item[], extra: object = {}) => ({
    supplierId,
    items,
    paymentTerms: { installments: 1 },
    ...extra,
  });

  const createSupplier = async () => {
    const s = await prisma.supplier.create({ data: { name: tag(), document: randomCpf() } });
    supplierIds.push(s.id);
    return s.id;
  };

  const payableOf = (purchaseId: string) =>
    prisma.financialDocument.findFirstOrThrow({
      where: { originType: "PURCHASE", originId: purchaseId },
      include: { parcels: { orderBy: { dueDate: "asc" } } },
    });

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
    supplierId = await createSupplier();
    otherSupplierId = await createSupplier();
    for (const set of [(id: string) => (v1 = id), (id: string) => (v2 = id)]) {
      const { variantId, cleanup } = await createTestVariant();
      variantCleanups.push(cleanup);
      set(variantId);
    }
  });

  after(async () => {
    try {
      // pagamentos → documentos/parcelas → itens → pedidos → fornecedores/variantes
      const documents = { originType: "PURCHASE" as const, originId: { in: purchaseIds } };
      await prisma.payment.deleteMany({ where: { parcel: { document: documents } } });
      await prisma.financialParcel.deleteMany({ where: { document: documents } });
      await prisma.financialDocument.deleteMany({ where: documents });
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
      for (const cleanup of variantCleanups) await cleanup();
    } finally {
      await admin.cleanup();
      await vendedor.cleanup();
      await estoquista.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("POST /purchases calcula total por item e geral em centavos e unitCost arredondado", async () => {
    const res = await createPurchase(
      body(
        [
          // 3 × 3,33 + 0,01 de frete = 10,00 → unitCost = round(1000 / 3) = 333 centavos
          { productVariantId: v1, quantity: 3, unitPrice: 3.33, freight: 0.01 },
          // 2 × 10,50 − 1,00 + 0,50 + 0,25 = 20,75 → unitCost = round(2075 / 2) = 1038 (meio para cima)
          { productVariantId: v2, quantity: 2, unitPrice: 10.5, discount: 1, freight: 0.5, tax: 0.25 },
        ],
        { notes: "  Entrega na loja  " },
      ),
    );
    assert.equal(res.statusCode, 201, res.body);
    const { data } = res.json();
    assert.match(data.code, /^PC\d{6}$/);
    assert.equal(data.status, "PENDING");
    assert.equal(data.purchaseDate, todayInBusinessTz());
    assert.equal(data.notes, "Entrega na loja");
    assert.equal(data.totalAmount, 30.75);
    assert.equal(data.supplier.id, supplierId);

    const byVariant = Object.fromEntries(data.items.map((i: any) => [i.productVariant.id, i]));
    assert.deepEqual(
      [byVariant[v1].total, byVariant[v1].unitCost, byVariant[v1].quantity, byVariant[v1].receivedQuantity, byVariant[v1].remainingQuantity],
      [10, 3.33, 3, 0, 3],
    );
    assert.deepEqual(
      [byVariant[v2].unitPrice, byVariant[v2].discount, byVariant[v2].freight, byVariant[v2].tax, byVariant[v2].total, byVariant[v2].unitCost],
      [10.5, 1, 0.5, 0.25, 20.75, 10.38],
    );

    const row = await prisma.purchase.findUniqueOrThrow({ where: { id: data.id }, include: { items: true } });
    assert.equal(row.code, data.code);
    assert.equal(row.status, "PENDING");
    assert.equal(row.origin, "MANUAL");
    assert.equal(row.totalAmount.toString(), "30.75");
    const v1Row = row.items.find((i) => i.productVariantId === v1)!;
    assert.equal(v1Row.unitCost.toString(), "3.33");
    assert.equal(v1Row.total.toString(), "10");

    // Review Focus 3: unitCost 333 × 3 = 999 ≠ 1000, mas as parcelas somam exatamente o total do pedido.
    const single = await createPurchase(
      body([{ productVariantId: v1, quantity: 3, unitPrice: 3.33, freight: 0.01 }], {
        paymentTerms: { installments: 3, firstDueDate: addDays(5) },
      }),
    );
    assert.equal(single.statusCode, 201, single.body);
    assert.equal(single.json().data.items[0].unitCost, 3.33);
    assert.equal(single.json().data.totalAmount, 10);
    const doc = await payableOf(single.json().data.id);
    assert.deepEqual(doc.parcels.map((p) => p.amount.toString()), ["3.33", "3.33", "3.34"]);
  });

  test("cria contas a pagar PAYABLE/SUPPLIER/PURCHASE com parcelas que somam o total exato", async () => {
    const first = addDays(10);
    const res = await createPurchase(
      body([{ productVariantId: v1, quantity: 7, unitPrice: 14.29 }], {
        paymentTerms: { installments: 3, firstDueDate: first },
      }),
    );
    assert.equal(res.statusCode, 201, res.body);
    const { data } = res.json();
    assert.equal(data.totalAmount, 100.03);

    const doc = await payableOf(data.id);
    assert.equal(doc.type, "PAYABLE");
    assert.equal(doc.originType, "PURCHASE");
    assert.equal(doc.partyType, "SUPPLIER");
    assert.equal(doc.partyId, supplierId);
    assert.equal(doc.status, "OPEN");
    assert.deepEqual(doc.parcels.map((p) => p.amount.toString()), ["33.34", "33.34", "33.35"]);
    // mesmo plano das vendas: vencimentos mensais a partir do primeiro
    assert.deepEqual(
      doc.parcels.map((p) => p.dueDate.toISOString().slice(0, 10)),
      buildInstallments(10003, 3, new Date(`${first}T00:00:00.000Z`)).map((p) => p.dueDate.toISOString().slice(0, 10)),
    );

    assert.equal(data.payable.id, doc.id);
    assert.equal(data.payable.status, "OPEN");
    assert.equal(data.payable.displayStatus, "OPEN");
    assert.deepEqual(
      data.payable.parcels.map((p: any) => [p.number, p.amount, p.paidAmount, p.remainingAmount, p.status]),
      [
        [1, 33.34, 0, 33.34, "OPEN"],
        [2, 33.34, 0, 33.34, "OPEN"],
        [3, 33.35, 0, 33.35, "OPEN"],
      ],
    );
    assert.equal(data.payable.parcels[0].dueDate, first);

    // 1 parcela sem firstDueDate → vence na data do pedido (retroativa: parcela vencida → OVERDUE).
    const past = addDays(-3);
    const backdated = await createPurchase(
      body([{ productVariantId: v2, quantity: 1, unitPrice: 5 }], { purchaseDate: past }),
    );
    assert.equal(backdated.statusCode, 201, backdated.body);
    const b = backdated.json().data;
    assert.equal(b.purchaseDate, past);
    assert.equal(b.payable.parcels.length, 1);
    assert.equal(b.payable.parcels[0].dueDate, past);
    assert.equal(b.payable.parcels[0].status, "OVERDUE");
    assert.equal(b.payable.displayStatus, "OVERDUE");
  });

  test("purchaseDate futura → 400; firstDueDate antes da data do pedido → 400; variante repetida → 400; total 0 → 422", async () => {
    const countBefore = await prisma.purchase.count({ where: { supplierId } });
    const item = { productVariantId: v1, quantity: 1, unitPrice: 10 };

    const future = await createPurchase(body([item], { purchaseDate: addDays(1) }));
    assert.equal(future.statusCode, 400);
    assert.ok(future.json().errors.some((e: any) => e.field === "purchaseDate"), future.body);

    const early = await createPurchase(
      body([item], { purchaseDate: addDays(-5), paymentTerms: { installments: 1, firstDueDate: addDays(-6) } }),
    );
    assert.equal(early.statusCode, 400);
    assert.ok(early.json().errors.some((e: any) => e.field === "paymentTerms.firstDueDate"), early.body);

    // vencimento passado mas não anterior ao pedido é aceito
    const sameDay = await createPurchase(
      body([item], { purchaseDate: addDays(-5), paymentTerms: { installments: 1, firstDueDate: addDays(-5) } }),
    );
    assert.equal(sameDay.statusCode, 201, sameDay.body);

    const repeated = await createPurchase(body([item, { ...item, quantity: 2 }]));
    assert.equal(repeated.statusCode, 400);
    assert.ok(repeated.json().errors.some((e: any) => e.field === "items.1.productVariantId"), repeated.body);

    const noFirstDue = await createPurchase(body([item], { paymentTerms: { installments: 2 } }));
    assert.equal(noFirstDue.statusCode, 400);

    for (const bad of [
      { ...item, quantity: 0 },
      { ...item, quantity: 1.5 },
      { ...item, unitPrice: -1 },
      { ...item, unitPrice: 1.234 },
      { ...item, discount: -0.01 },
    ]) {
      const res = await createPurchase(body([bad]));
      assert.equal(res.statusCode, 400, JSON.stringify(bad));
    }
    assert.equal((await createPurchase(body([]))).statusCode, 400);
    assert.equal((await createPurchase(body([item], { notes: "x".repeat(501) }))).statusCode, 400);

    const zero = await createPurchase(body([{ ...item, unitPrice: 0 }]));
    assert.equal(zero.statusCode, 422);
    assert.deepEqual(zero.json(), { message: "O total do pedido deve ser maior que zero.", code: "PURCHASE_TOTAL_ZERO" });

    const negative = await createPurchase(body([{ ...item, unitPrice: 1, discount: 2 }]));
    assert.equal(negative.statusCode, 422);
    assert.deepEqual(negative.json(), { message: "Total do item não pode ser negativo.", code: "INVALID_ITEM_TOTAL" });

    const tooManyParcels = await createPurchase(
      body([{ ...item, unitPrice: 0.02 }], { paymentTerms: { installments: 3, firstDueDate: addDays(1) } }),
    );
    assert.equal(tooManyParcels.statusCode, 422);
    assert.equal(tooManyParcels.json().code, "INSTALLMENTS_EXCEED_TOTAL");

    const noSupplier = await createPurchase(body([item], { supplierId: randomUUID() }));
    assert.equal(noSupplier.statusCode, 404);
    assert.equal(noSupplier.json().code, "SUPPLIER_NOT_FOUND");

    const noVariant = await createPurchase(body([{ ...item, productVariantId: randomUUID() }]));
    assert.equal(noVariant.statusCode, 404);
    assert.equal(noVariant.json().code, "VARIANT_NOT_FOUND");

    // Só o pedido válido foi gravado; nada de documento órfão.
    assert.equal(await prisma.purchase.count({ where: { supplierId } }), countBefore + 1);
    assert.equal(
      await prisma.financialDocument.count({ where: { originType: "PURCHASE", partyId: supplierId, originId: { notIn: purchaseIds } } }),
      0,
    );

    assert.equal((await createPurchase(body([item]), estoquista)).statusCode, 403);
    assert.equal((await createPurchase(body([item]), vendedor)).statusCode, 403);
  });

  test("GET /purchases filtra por status, fornecedor e período; GET /:id com payable; chaves = fixtures", async () => {
    const supplier = await createSupplier();
    const mk = async (purchaseDate: string, items: Item[]) => {
      const res = await createPurchase({ supplierId: supplier, purchaseDate, items, paymentTerms: { installments: 1 } });
      assert.equal(res.statusCode, 201, res.body);
      return res.json().data;
    };
    const older = await mk(addDays(-20), [{ productVariantId: v1, quantity: 3, unitPrice: 1 }]);
    const newer = await mk(addDays(-2), [
      { productVariantId: v1, quantity: 3, unitPrice: 1 },
      { productVariantId: v2, quantity: 2, unitPrice: 1 },
    ]);
    const middle = await mk(addDays(-10), [{ productVariantId: v2, quantity: 1, unitPrice: 2 }]);
    // outro fornecedor, mesma data: não aparece no filtro por fornecedor
    const foreign = (await createPurchase({
      supplierId: otherSupplierId,
      purchaseDate: addDays(-2),
      items: [{ productVariantId: v1, quantity: 1, unitPrice: 1 }],
      paymentTerms: { installments: 1 },
    })).json().data;

    // Recebimento ainda não existe (Tarefa 3): simula 1 de 5 unidades recebidas → floor(20%) e 1 de 3 → floor(33,3%).
    await prisma.purchaseItem.updateMany({ where: { purchaseId: newer.id, productVariantId: v1 }, data: { receivedQuantity: 1 } });
    await prisma.purchaseItem.updateMany({ where: { purchaseId: older.id }, data: { receivedQuantity: 1 } });

    const list = await call("GET", `/purchases?supplierId=${supplier}&limit=100`, estoquista);
    assert.equal(list.statusCode, 200, list.body);
    const listed = list.json();
    assert.deepEqual(listed.data.map((p: any) => p.id), [newer.id, middle.id, older.id]);
    assert.equal(listed.pagination.total, 3);
    const n = listed.data[0];
    assert.deepEqual(
      [n.code, n.status, n.supplier, n.purchaseDate, n.totalAmount, n.itemsCount, n.receivedPercent],
      [newer.code, "PENDING", newer.supplier, addDays(-2), 5, 2, 20],
    );
    assert.equal(listed.data[2].receivedPercent, 33);
    assert.equal(listed.data[1].receivedPercent, 0);
    assert.deepEqual(keyShape(listed), keyShape(loadFixture("purchaseList")));

    const period = await call("GET", `/purchases?supplierId=${supplier}&from=${addDays(-10)}&to=${addDays(-2)}`, admin);
    assert.deepEqual(period.json().data.map((p: any) => p.id), [newer.id, middle.id]);

    const byCode = await call("GET", `/purchases?search=${older.code.toLowerCase()}&limit=100`, admin);
    const byCodeIds = byCode.json().data.map((p: any) => p.id);
    assert.ok(byCodeIds.includes(older.id) && !byCodeIds.includes(newer.id), byCode.body);

    const sameDay = await call("GET", `/purchases?from=${addDays(-2)}&to=${addDays(-2)}&limit=100`, admin);
    const sameDayIds = sameDay.json().data.map((p: any) => p.id);
    assert.ok(sameDayIds.includes(foreign.id) && sameDayIds.includes(newer.id));
    assert.ok(!sameDayIds.includes(middle.id));

    const cancel = await call("POST", `/purchases/${middle.id}/cancel`, admin, { reason: "Pedido duplicado" });
    assert.equal(cancel.statusCode, 200, cancel.body);
    const canceled = await call("GET", `/purchases?supplierId=${supplier}&status=CANCELED`, admin);
    assert.deepEqual(canceled.json().data.map((p: any) => p.id), [middle.id]);
    const pending = await call("GET", `/purchases?supplierId=${supplier}&status=PENDING`, admin);
    assert.deepEqual(pending.json().data.map((p: any) => p.id), [newer.id, older.id]);

    for (const bad of ["status=DRAFT", "from=2026-13-01", "limit=101", `supplierId=nope`]) {
      assert.equal((await call("GET", `/purchases?${bad}`, admin)).statusCode, 400, bad);
    }

    // ESTOQUISTA (sem payables.read) não recebe os dados financeiros.
    const stockDetail = await call("GET", `/purchases/${newer.id}`, estoquista);
    assert.equal(stockDetail.statusCode, 200, stockDetail.body);
    assert.equal(stockDetail.json().data.payable, null);

    const detail = await call("GET", `/purchases/${newer.id}`, admin);
    assert.equal(detail.statusCode, 200, detail.body);
    const d = detail.json();
    assert.equal(d.data.id, newer.id);
    assert.ok(d.data.payable);
    const item = d.data.items.find((i: any) => i.productVariant.id === v1);
    assert.deepEqual([item.receivedQuantity, item.remainingQuantity], [1, 2]);
    assert.deepEqual(keyShape(d), keyShape(loadFixture("purchaseDetail")));

    const missing = await call("GET", `/purchases/${randomUUID()}`, admin);
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.json(), { message: "Pedido de compra não encontrado.", code: "PURCHASE_NOT_FOUND" });
    assert.equal((await call("GET", "/purchases/not-a-uuid", admin)).statusCode, 400);

    assert.equal((await call("GET", "/purchases", vendedor)).statusCode, 403);
    assert.equal((await call("GET", `/purchases/${newer.id}`, vendedor)).statusCode, 403);
  });

  test("cancelar sem recebimento → CANCELED e documento CANCELED; com pagamento → 409 PURCHASE_HAS_PAYMENTS; duas vezes → 409", async () => {
    const mk = async () => {
      const res = await createPurchase(
        body([{ productVariantId: v1, quantity: 2, unitPrice: 50 }], {
          paymentTerms: { installments: 2, firstDueDate: addDays(30) },
        }),
      );
      assert.equal(res.statusCode, 201, res.body);
      return res.json().data;
    };

    // sem recebimento nem pagamento → 200
    const ok = await mk();
    assert.equal((await call("POST", `/purchases/${ok.id}/cancel`, estoquista, { reason: "Sem estoque" })).statusCode, 403);
    assert.equal((await call("POST", `/purchases/${ok.id}/cancel`, admin, { reason: "ab" })).statusCode, 400);
    assert.equal((await call("POST", `/purchases/${ok.id}/cancel`, admin, {})).statusCode, 400);
    const res = await call("POST", `/purchases/${ok.id}/cancel`, admin, { reason: "  Fornecedor sem estoque  " });
    assert.equal(res.statusCode, 200, res.body);
    const { data } = res.json();
    assert.equal(data.status, "CANCELED");
    assert.equal(data.payable.status, "CANCELED");
    assert.deepEqual(data.payable.parcels.map((p: any) => p.status), ["CANCELED", "CANCELED"]);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("purchaseDetail")));
    const row = await prisma.purchase.findUniqueOrThrow({ where: { id: ok.id } });
    assert.equal(row.cancelReason, "Fornecedor sem estoque");
    assert.ok(row.canceledAt);
    assert.equal(row.canceledById, admin.id);
    assert.equal((await payableOf(ok.id)).status, "CANCELED");

    // duas vezes → 409
    const twice = await call("POST", `/purchases/${ok.id}/cancel`, admin, { reason: "de novo" });
    assert.equal(twice.statusCode, 409);
    assert.deepEqual(twice.json(), { message: "Pedido já está cancelado.", code: "PURCHASE_ALREADY_CANCELED" });

    // com pagamento ativo → 409; nada muda
    const paid = await mk();
    const paidDoc = await payableOf(paid.id);
    const payment = await prisma.payment.create({
      data: { parcelId: paidDoc.parcels[0].id, amount: 10, method: "PIX", paymentDate: new Date() },
    });
    const blocked = await call("POST", `/purchases/${paid.id}/cancel`, admin, { reason: "Tentativa" });
    assert.equal(blocked.statusCode, 409);
    assert.deepEqual(blocked.json(), {
      message: "Pedido com pagamentos registrados não pode ser cancelado.",
      code: "PURCHASE_HAS_PAYMENTS",
    });
    assert.equal((await prisma.purchase.findUniqueOrThrow({ where: { id: paid.id } })).status, "PENDING");
    assert.equal((await payableOf(paid.id)).status, "OPEN");

    // pagamento estornado não bloqueia
    await prisma.payment.update({
      where: { id: payment.id },
      data: { reversedAt: new Date(), reversalReason: "tx-test", reversedById: admin.id },
    });
    assert.equal((await call("POST", `/purchases/${paid.id}/cancel`, admin, { reason: "Agora pode" })).statusCode, 200);

    // com recebimento → 409 (recebimento simulado direto no banco; Tarefa 3 cria a rota)
    const received = await mk();
    await prisma.purchaseItem.updateMany({ where: { purchaseId: received.id }, data: { receivedQuantity: 1 } });
    const hasReceipts = await call("POST", `/purchases/${received.id}/cancel`, admin, { reason: "Tentativa" });
    assert.equal(hasReceipts.statusCode, 409);
    assert.deepEqual(hasReceipts.json(), {
      message: "Pedido com recebimentos não pode ser cancelado.",
      code: "PURCHASE_HAS_RECEIPTS",
    });
    assert.equal((await payableOf(received.id)).status, "OPEN");

    // cancelamentos simultâneos → exatamente um conclui
    const race = await mk();
    const results = await Promise.all(
      [1, 2].map(() => call("POST", `/purchases/${race.id}/cancel`, admin, { reason: "Simultâneo" })),
    );
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);

    const missing = await call("POST", `/purchases/${randomUUID()}/cancel`, admin, { reason: "Qualquer" });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().code, "PURCHASE_NOT_FOUND");
  });

  test("detalhe devolve os itens na ordem em que foram enviados", async () => {
    for (const order of [[v2, v1], [v1, v2]]) {
      const res = await createPurchase(
        body(order.map((productVariantId, i) => ({ productVariantId, quantity: i + 1, unitPrice: 1 }))),
      );
      assert.equal(res.statusCode, 201, res.body);
      assert.deepEqual(res.json().data.items.map((i: any) => i.productVariant.id), order);
      const detail = await call("GET", `/purchases/${res.json().data.id}`, admin);
      assert.deepEqual(detail.json().data.items.map((i: any) => [i.productVariant.id, i.quantity]), [
        [order[0], 1],
        [order[1], 2],
      ]);
    }
  });
});
