import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { randomCpf } from "../../../../../test/documentFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/finance/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

type Res = Awaited<ReturnType<typeof app.inject>>;

const settled = (results: PromiseSettledResult<Res>[]) =>
  results.map((r) => {
    assert.equal(r.status, "fulfilled");
    return (r as PromiseFulfilledResult<Res>).value;
  });

describe("Contas a pagar (/payables)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  let variantId: string;
  let customerId: string;
  const suppliers: Record<"a" | "b" | "c", { id: string; name: string }> = {} as never;
  const variantCleanups: (() => Promise<void>)[] = [];
  const purchaseIds: string[] = [];
  /** Pedidos do fornecedor A (cenário de lista): id do pedido, código e id do payable. */
  const p: Record<string, { purchaseId: string; code: string; documentId: string; parcelIds: string[] }> = {};

  const call = (method: "GET" | "POST", url: string, user: TestUser = admin, payload?: object) =>
    app.inject({ method, url, headers: withIdempotencyKey(method, { authorization: `Bearer ${user.token}` }), payload });

  /** Pedido de 1 item com o total dado; devolve pedido, código, payable e parcelas (por vencimento). */
  const createPurchase = async (
    supplierId: string,
    total: number,
    opts: { purchaseDate?: string; installments?: number; firstDueDate?: string } = {},
  ) => {
    const res = await call("POST", "/purchases", admin, {
      supplierId,
      ...(opts.purchaseDate ? { purchaseDate: opts.purchaseDate } : {}),
      items: [{ productVariantId: variantId, quantity: 1, unitPrice: total }],
      paymentTerms: {
        installments: opts.installments ?? 1,
        ...(opts.firstDueDate ? { firstDueDate: opts.firstDueDate } : {}),
      },
    });
    assert.equal(res.statusCode, 201, res.body);
    const { id, code } = res.json().data;
    purchaseIds.push(id);
    const doc = await prisma.financialDocument.findFirstOrThrow({
      where: { originType: "PURCHASE", originId: id },
      include: { parcels: { orderBy: { dueDate: "asc" } } },
    });
    return { purchaseId: id as string, code: code as string, documentId: doc.id, parcelIds: doc.parcels.map((x) => x.id) };
  };

  const pay = (documentId: string, parcelId: string, body: object, user = admin, prefix = "/payables") =>
    call("POST", `${prefix}/${documentId}/parcels/${parcelId}/payments`, user, body);
  const reverse = (paymentId: string, body: object, user = admin, prefix = "/payables") =>
    call("POST", `${prefix}/payments/${paymentId}/reverse`, user, body);
  const cancelPurchase = (purchaseId: string) =>
    call("POST", `/purchases/${purchaseId}/cancel`, admin, { reason: "Pedido errado" });

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
    for (const key of ["a", "b", "c"] as const) {
      const s = await prisma.supplier.create({ data: { name: `tx-test-${randomUUID()}`, document: randomCpf() } });
      suppliers[key] = { id: s.id, name: s.name };
    }
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
    const v = await createTestVariant();
    variantCleanups.push(v.cleanup);
    variantId = v.variantId;

    const a = suppliers.a.id;
    // OPEN, vence hoje (a vencer).
    p.open = await createPurchase(a, 100);
    // OPEN com vencimento passado → OVERDUE.
    p.overdue = await createPurchase(a, 50, { purchaseDate: addDays(-10) });
    // PAID (vencimento passado, mas quitado).
    p.paid = await createPurchase(a, 40, { purchaseDate: addDays(-30) });
    let res = await pay(p.paid.documentId, p.paid.parcelIds[0], { amount: 40, method: "PIX" });
    assert.equal(res.statusCode, 201, res.body);
    // CANCELED (vencimento passado).
    p.canceled = await createPurchase(a, 70, { purchaseDate: addDays(-3) });
    assert.equal((await cancelPurchase(p.canceled.purchaseId)).statusCode, 200);
    // PARTIALLY_PAID: 2 × 30,00 a partir de +20; pagamento estornado + pagamento ativo de 10,00.
    p.partial = await createPurchase(a, 60, { installments: 2, firstDueDate: addDays(20) });
    res = await pay(p.partial.documentId, p.partial.parcelIds[0], { amount: 10, method: "BOLETO" });
    assert.equal(res.statusCode, 201, res.body);
    const firstPaymentId = res.json().data.parcels[0].payments[0].id;
    res = await reverse(firstPaymentId, { reason: "Pago na conta errada" });
    assert.equal(res.statusCode, 200, res.body);
    res = await pay(p.partial.documentId, p.partial.parcelIds[0], { amount: 10, method: "PIX" });
    assert.equal(res.statusCode, 201, res.body);
    // Fornecedor B: um payable em aberto (não aparece no filtro do A).
    p.other = await createPurchase(suppliers.b.id, 12.34);
  });

  after(async () => {
    try {
      const documents = {
        OR: [{ originType: "PURCHASE" as const, originId: { in: purchaseIds } }, { partyId: customerId }],
      };
      await prisma.payment.deleteMany({ where: { parcel: { document: documents } } });
      await prisma.financialParcel.deleteMany({ where: { document: documents } });
      await deleteFinancialDocuments({ where: documents });
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.supplier.deleteMany({ where: { id: { in: Object.values(suppliers).map((s) => s.id) } } });
      await prisma.customer.deleteMany({ where: { id: customerId } });
      for (const cleanup of variantCleanups) await cleanup();
    } finally {
      await admin.cleanup();
      await vendedor.cleanup();
      await estoquista.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("GET /payables lista só PAYABLE com fornecedor e purchaseCode; filtros e summary", async () => {
    const a = suppliers.a.id;
    const res = await call("GET", `/payables?supplierId=${a}&limit=100`);
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    // Ordem: em aberto por próximo vencimento (vencido, hoje, +20), depois quitados/cancelados por criação.
    assert.deepEqual(
      body.data.map((d: any) => d.id),
      [p.overdue, p.open, p.partial, p.paid, p.canceled].map((x) => x.documentId),
    );
    assert.deepEqual(body.pagination, { page: 1, limit: 100, total: 5, totalPages: 1 });
    // A vencer: 100 (hoje) + 50 (parcial: 20 + 30) ; vencido: 50 ; pago: 40 + 10 (estornado não conta).
    assert.deepEqual(body.summary, { openAmount: 150, overdueAmount: 50, paidAmount: 50 });

    const byId = Object.fromEntries(body.data.map((d: any) => [d.id, d]));
    const partial = byId[p.partial.documentId];
    assert.deepEqual(partial.supplier, suppliers.a);
    assert.equal(partial.purchaseCode, p.partial.code);
    assert.equal(partial.originType, "PURCHASE");
    assert.equal(partial.originId, p.partial.purchaseId);
    assert.equal(partial.status, "PARTIALLY_PAID");
    assert.deepEqual(
      [partial.totalAmount, partial.paidAmount, partial.remainingAmount, partial.nextDueDate, partial.parcelsCount],
      [60, 10, 50, addDays(20), 2],
    );
    assert.equal("customer" in partial, false);
    assert.equal(byId[p.overdue.documentId].displayStatus, "OVERDUE");
    assert.equal(byId[p.canceled.documentId].displayStatus, "CANCELED");
    assert.equal(byId[p.paid.documentId].nextDueDate, null);

    const ids = async (query: string) => {
      const r = await call("GET", `/payables?supplierId=${a}&${query}`);
      assert.equal(r.statusCode, 200, `${query}: ${r.body}`);
      return r.json().data.map((d: any) => d.id);
    };
    assert.deepEqual(await ids("status=OVERDUE"), [p.overdue.documentId]);
    assert.deepEqual(await ids("status=OPEN"), [p.open.documentId]);
    assert.deepEqual(await ids("status=PARTIALLY_PAID"), [p.partial.documentId]);
    assert.deepEqual(await ids("status=PAID"), [p.paid.documentId]);
    assert.deepEqual(await ids("status=CANCELED"), [p.canceled.documentId]);
    assert.deepEqual(await ids(`dueFrom=${TODAY}&dueTo=${TODAY}`), [p.open.documentId]);
    assert.deepEqual(await ids(`dueFrom=${addDays(-11)}&dueTo=${addDays(-1)}`), [
      p.overdue.documentId,
      p.canceled.documentId,
    ]);
    assert.deepEqual(await ids("page=2&limit=2"), [p.partial.documentId, p.paid.documentId]);

    const other = await call("GET", `/payables?supplierId=${suppliers.b.id}`);
    assert.deepEqual(other.json().data.map((d: any) => d.id), [p.other.documentId]);
    assert.deepEqual(other.json().data[0].supplier, suppliers.b);

    for (const query of ["limit=101", "status=FOO", "supplierId=abc", `dueFrom=${TODAY}&dueTo=${addDays(-1)}`]) {
      const bad = await call("GET", `/payables?${query}`);
      assert.equal(bad.statusCode, 400, `${query}: ${bad.body}`);
    }

    // Detalhe com pagamentos (estornado primeiro).
    const detail = await call("GET", `/payables/${p.partial.documentId}`);
    assert.equal(detail.statusCode, 200, detail.body);
    const d = detail.json().data;
    assert.deepEqual(d.supplier, suppliers.a);
    assert.equal(d.purchaseCode, p.partial.code);
    assert.equal(d.parcels.length, 2);
    assert.equal(d.parcels[0].payments.length, 2);
    assert.ok(d.parcels[0].payments[0].reversedAt);
    assert.equal(d.parcels[0].payments[0].reversalReason, "Pago na conta errada");
    assert.deepEqual(d.parcels[0].payments[0].reversedBy, { id: admin.id, name: admin.name });

    const missing = await call("GET", `/payables/${randomUUID()}`);
    assert.equal(missing.statusCode, 404, missing.body);
    assert.deepEqual(missing.json(), { message: "Conta a pagar não encontrada.", code: "FINANCIAL_DOCUMENT_NOT_FOUND" });
  });

  test("pagar parcela e estornar via /payables seguem as regras da 3B", async () => {
    const c = suppliers.c.id;
    const doc = await createPurchase(c, 66.68, { installments: 2, firstDueDate: TODAY }); // 33,34 + 33,34

    const partial = await pay(doc.documentId, doc.parcelIds[0], { amount: 33.33, method: "PIX", reference: "  TED-1  " });
    assert.equal(partial.statusCode, 201, partial.body);
    let d = partial.json().data;
    assert.equal(d.id, doc.documentId);
    assert.equal(d.status, "PARTIALLY_PAID");
    assert.deepEqual(d.supplier, suppliers.c);
    assert.equal(d.purchaseCode, doc.code);
    assert.equal(d.parcels[0].remainingAmount, 0.01);
    assert.equal(d.parcels[0].payments[0].reference, "TED-1");
    assert.deepEqual(d.parcels[0].payments[0].createdBy, { id: admin.id, name: admin.name });

    const tooMuch = await pay(doc.documentId, doc.parcelIds[0], { amount: 0.02, method: "PIX" });
    assert.equal(tooMuch.statusCode, 422, tooMuch.body);
    assert.equal(tooMuch.json().code, "PAYMENT_EXCEEDS_REMAINING");
    const future = await pay(doc.documentId, doc.parcelIds[0], { amount: 0.01, method: "PIX", paymentDate: addDays(1) });
    assert.equal(future.statusCode, 400, future.body);
    const bad = await pay(doc.documentId, doc.parcelIds[0], { amount: 0, method: "PIX" });
    assert.equal(bad.statusCode, 400, bad.body);
    const missingDoc = await pay(randomUUID(), doc.parcelIds[0], { amount: 1, method: "PIX" });
    assert.equal(missingDoc.statusCode, 404, missingDoc.body);
    assert.deepEqual(missingDoc.json(), { message: "Conta a pagar não encontrada.", code: "FINANCIAL_DOCUMENT_NOT_FOUND" });
    const otherParcel = await pay(doc.documentId, p.open.parcelIds[0], { amount: 1, method: "PIX" });
    assert.equal(otherParcel.statusCode, 404, otherParcel.body);
    assert.equal(otherParcel.json().code, "PARCEL_NOT_FOUND");

    await pay(doc.documentId, doc.parcelIds[0], { amount: 0.01, method: "PIX" });
    const full = await pay(doc.documentId, doc.parcelIds[1], { amount: 33.34, method: "CASH" });
    assert.equal(full.statusCode, 201, full.body);
    d = full.json().data;
    assert.equal(d.status, "PAID");
    assert.equal(d.paidAmount, 66.68);
    const paymentId = d.parcels[1].payments[0].id;

    // Pedido com pagamento ativo não cancela.
    const blocked = await cancelPurchase(doc.purchaseId);
    assert.equal(blocked.statusCode, 409, blocked.body);
    assert.equal(blocked.json().code, "PURCHASE_HAS_PAYMENTS");

    for (const body of [{}, { reason: "ab" }]) {
      const r = await reverse(paymentId, body);
      assert.equal(r.statusCode, 400, r.body);
    }
    const reversed = await reverse(paymentId, { reason: "  Pagamento duplicado  " });
    assert.equal(reversed.statusCode, 200, reversed.body);
    d = reversed.json().data;
    assert.equal(d.status, "PARTIALLY_PAID");
    assert.equal(d.parcels[1].status, "OPEN");
    assert.equal(d.parcels[1].payments[0].reversalReason, "Pagamento duplicado");
    assert.deepEqual(d.parcels[1].payments[0].reversedBy, { id: admin.id, name: admin.name });
    const again = await reverse(paymentId, { reason: "de novo" });
    assert.equal(again.statusCode, 409, again.body);
    assert.equal(again.json().code, "PAYMENT_ALREADY_REVERSED");
    const missingPayment = await reverse(randomUUID(), { reason: "abc" });
    assert.equal(missingPayment.statusCode, 404, missingPayment.body);
    assert.equal(missingPayment.json().code, "PAYMENT_NOT_FOUND");

    // Estorna o resto e cancela o pedido: pagar o payable cancelado → 409 com mensagem de conta a pagar.
    const detail = (await call("GET", `/payables/${doc.documentId}`)).json().data;
    for (const parcel of detail.parcels) {
      for (const payment of parcel.payments) {
        if (!payment.reversedAt) assert.equal((await reverse(payment.id, { reason: "devolução" })).statusCode, 200);
      }
    }
    assert.equal((await cancelPurchase(doc.purchaseId)).statusCode, 200);
    const canceled = await pay(doc.documentId, doc.parcelIds[0], { amount: 1, method: "PIX" });
    assert.equal(canceled.statusCode, 409, canceled.body);
    assert.deepEqual(canceled.json(), { message: "Conta a pagar cancelada.", code: "FINANCIAL_DOCUMENT_CANCELED" });
    const canceledDoc = (await call("GET", `/payables/${doc.documentId}`)).json().data;
    assert.equal(canceledDoc.status, "CANCELED");
  });

  test("pagar um recebível via /payables → 404; pagar um payable via /receivables → 404", async () => {
    // Recebível com uma parcela e um pagamento ativo.
    const receivable = await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: "SALE",
        originId: randomUUID(),
        partyId: customerId,
        partyType: "CUSTOMER",
        status: "PARTIALLY_PAID",
        parcels: {
          create: [
            {
              amount: 50,
              dueDate: asDate(addDays(10)),
              payments: {
                create: [{ amount: 5, method: "PIX", paymentDate: asDate(TODAY), createdById: admin.id }],
              },
            },
          ],
        },
      },
      include: { parcels: { include: { payments: true } } },
    });
    const rParcel = receivable.parcels[0];
    const rPaymentId = rParcel.payments[0].id;

    const payable = await createPurchase(suppliers.c.id, 20);
    const paid = await pay(payable.documentId, payable.parcelIds[0], { amount: 5, method: "PIX" });
    assert.equal(paid.statusCode, 201, paid.body);
    const pPaymentId = paid.json().data.parcels[0].payments[0].id;

    const notFoundDoc = (label: string) => ({ message: `${label} não encontrada.`, code: "FINANCIAL_DOCUMENT_NOT_FOUND" });

    let r = await pay(receivable.id, rParcel.id, { amount: 1, method: "PIX" }, admin, "/payables");
    assert.equal(r.statusCode, 404, r.body);
    assert.deepEqual(r.json(), notFoundDoc("Conta a pagar"));
    r = await pay(payable.documentId, payable.parcelIds[0], { amount: 1, method: "PIX" }, admin, "/receivables");
    assert.equal(r.statusCode, 404, r.body);
    assert.deepEqual(r.json(), notFoundDoc("Conta a receber"));

    r = await reverse(rPaymentId, { reason: "cruzado" }, admin, "/payables");
    assert.equal(r.statusCode, 404, r.body);
    assert.equal(r.json().code, "PAYMENT_NOT_FOUND");
    r = await reverse(pPaymentId, { reason: "cruzado" }, admin, "/receivables");
    assert.equal(r.statusCode, 404, r.body);
    assert.equal(r.json().code, "PAYMENT_NOT_FOUND");

    r = await call("GET", `/payables/${receivable.id}`);
    assert.equal(r.statusCode, 404, r.body);
    r = await call("GET", `/receivables/${payable.documentId}`);
    assert.equal(r.statusCode, 404, r.body);
    // Listas: recebível não aparece em /payables e vice-versa.
    r = await call("GET", `/payables?supplierId=${customerId}`);
    assert.equal(r.json().pagination.total, 0);
    r = await call("GET", `/receivables?customerId=${suppliers.c.id}`);
    assert.equal(r.json().pagination.total, 0);

    // Nada foi gravado.
    assert.equal(await prisma.payment.count({ where: { parcelId: rParcel.id } }), 1);
    assert.equal(await prisma.payment.count({ where: { parcelId: payable.parcelIds[0] } }), 1);
    const payments = await prisma.payment.findMany({ where: { id: { in: [rPaymentId, pPaymentId] } } });
    assert.ok(payments.every((x) => x.reversedAt === null));
    assert.equal((await prisma.financialDocument.findUniqueOrThrow({ where: { id: receivable.id } })).status, "PARTIALLY_PAID");
  });

  test("VENDEDOR e ESTOQUISTA → 403 em /payables; chaves = fixtures", async () => {
    const { documentId, parcelIds } = p.partial;
    const paymentId = randomUUID();
    const routes: [("GET" | "POST"), string, object | undefined][] = [
      ["GET", "/payables", undefined],
      ["GET", `/payables/${documentId}`, undefined],
      ["POST", `/payables/${documentId}/parcels/${parcelIds[0]}/payments`, { amount: 1, method: "PIX" }],
      ["POST", `/payables/payments/${paymentId}/reverse`, { reason: "abc" }],
    ];
    for (const user of [vendedor, estoquista]) {
      for (const [method, url, payload] of routes) {
        const r = await call(method, url, user, payload);
        assert.equal(r.statusCode, 403, `${user.role} ${method} ${url}: ${r.body}`);
        assert.deepEqual(r.json(), { message: "Acesso negado.", code: "FORBIDDEN" });
      }
    }
    assert.equal(await prisma.payment.count({ where: { parcelId: parcelIds[0] } }), 2);

    const list = await call("GET", `/payables?supplierId=${suppliers.a.id}`);
    assert.equal(list.statusCode, 200, list.body);
    assert.deepEqual(keyShape(list.json()), keyShape(loadFixture("payableList")));
    const detail = await call("GET", `/payables/${documentId}`);
    assert.equal(detail.statusCode, 200, detail.body);
    assert.deepEqual(keyShape(detail.json()), keyShape(loadFixture("payableDetail")));
  });

  test("pagamento × cancelamento do pedido simultâneos → exatamente um conclui", async () => {
    for (let round = 0; round < 3; round++) {
      const doc = await createPurchase(suppliers.c.id, 10);
      const [payment, cancel] = settled(
        await Promise.allSettled([
          pay(doc.documentId, doc.parcelIds[0], { amount: 10, method: "PIX" }),
          cancelPurchase(doc.purchaseId),
        ]),
      );
      const statuses = [payment.statusCode, cancel.statusCode].sort();
      const paymentWon = payment.statusCode === 201;
      if (paymentWon) {
        assert.equal(cancel.statusCode, 409, cancel.body);
        assert.equal(cancel.json().code, "PURCHASE_HAS_PAYMENTS");
      } else {
        assert.equal(cancel.statusCode, 200, cancel.body);
        assert.equal(payment.statusCode, 409, payment.body);
        assert.equal(payment.json().code, "FINANCIAL_DOCUMENT_CANCELED");
      }
      assert.equal(statuses.filter((s) => s < 300).length, 1, `round ${round}: ${statuses}`);

      const row = await prisma.financialDocument.findUniqueOrThrow({ where: { id: doc.documentId } });
      const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: doc.purchaseId } });
      const paymentsCount = await prisma.payment.count({ where: { parcelId: doc.parcelIds[0] } });
      if (paymentWon) {
        assert.deepEqual([row.status, purchase.status, paymentsCount], ["PAID", "PENDING", 1]);
      } else {
        assert.deepEqual([row.status, purchase.status, paymentsCount], ["CANCELED", "CANCELED", 0]);
      }
    }
  });
});
