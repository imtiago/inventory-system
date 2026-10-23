import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { randomCpf } from "../../../../../test/documentFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/purchases/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

type Item = { productVariantId: string; quantity: number; unitPrice: number; freight?: number };
type ReceiptItem = {
  purchaseItemId: string;
  quantity: number;
  batchNumber?: string;
  manufacturingDate?: string;
  expirationDate?: string;
};

describe("Recebimento de pedidos de compra (POST /purchases/:id/receipts)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  let supplierId: string;
  const variantIds: string[] = [];
  const variantCleanups: (() => Promise<void>)[] = [];
  const supplierIds: string[] = [];
  const purchaseIds: string[] = [];

  const call = (method: "GET" | "POST", url: string, user: TestUser, payload?: object) =>
    app.inject({ method, url, headers: withIdempotencyKey(method, { authorization: `Bearer ${user.token}` }), payload });

  const freshVariant = async () => {
    const { variantId, cleanup } = await createTestVariant();
    variantIds.push(variantId);
    variantCleanups.push(cleanup);
    return variantId;
  };

  /** Cria o pedido (ADMIN) e devolve o DTO de detalhe. */
  const createPurchase = async (items: Item[]) => {
    const res = await call("POST", "/purchases", admin, { supplierId, items, paymentTerms: { installments: 1 } });
    assert.equal(res.statusCode, 201, res.body);
    const data = res.json().data;
    purchaseIds.push(data.id);
    return data;
  };

  const receive = (purchaseId: string, items: ReceiptItem[], user = admin) =>
    call("POST", `/purchases/${purchaseId}/receipts`, user, { items });

  const itemOf = (purchase: any, variantId: string) =>
    purchase.items.find((i: any) => i.productVariant.id === variantId);

  const stockOf = async (variantId: string) =>
    (await prisma.inventory.findUnique({ where: { productVariantId: variantId } }))?.quantity ?? 0;

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
    const s = await prisma.supplier.create({ data: { name: `tx-test-${randomUUID()}`, document: randomCpf() } });
    supplierIds.push(s.id);
    supplierId = s.id;
  });

  after(async () => {
    try {
      // documentos → movimentações/lotes (FK para o item) → itens → pedidos → fornecedores → variantes
      const documents = { originType: "PURCHASE" as const, originId: { in: purchaseIds } };
      await prisma.payment.deleteMany({ where: { parcel: { document: documents } } });
      await prisma.financialParcel.deleteMany({ where: { document: documents } });
      await prisma.financialDocument.deleteMany({ where: documents });
      await prisma.stockMovement.deleteMany({ where: { productVariantId: { in: variantIds } } });
      await prisma.inventoryLot.deleteMany({ where: { productVariantId: { in: variantIds } } });
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

  test("recebimento parcial → PARTIALLY_RECEIVED; estoque, custo médio, lote com purchaseItemId e movimentação PURCHASE com userId", async () => {
    const v1 = await freshVariant();
    const v2 = await freshVariant();
    // Estoque prévio de v1: 10 un a 2,00.
    await prisma.inventory.create({ data: { productVariantId: v1, quantity: 10, averageCost: 2 } });

    // 4 × 3,33 + 0,01 = 13,33 → unitCost = round(1333 / 4) = 333 → 3,33
    const purchase = await createPurchase([
      { productVariantId: v1, quantity: 4, unitPrice: 3.33, freight: 0.01 },
      { productVariantId: v2, quantity: 2, unitPrice: 10 },
    ]);
    const itemA = itemOf(purchase, v1);
    const batch = `tx-test-${randomUUID().slice(0, 8)}`;

    const res = await receive(purchase.id, [
      {
        purchaseItemId: itemA.id,
        quantity: 3,
        batchNumber: `  ${batch}  `,
        manufacturingDate: "2026-01-15",
        expirationDate: "2027-01-15",
      },
    ]);
    assert.equal(res.statusCode, 201, res.body);
    const { data } = res.json();
    assert.equal(data.id, purchase.id);
    assert.equal(data.status, "PARTIALLY_RECEIVED");
    assert.deepEqual(
      [itemOf(data, v1).receivedQuantity, itemOf(data, v1).remainingQuantity],
      [3, 1],
    );
    assert.deepEqual([itemOf(data, v2).receivedQuantity, itemOf(data, v2).remainingQuantity], [0, 2]);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("purchaseDetail")));

    // Estoque e custo médio (fórmula de Inventory.receive: média ponderada).
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: v1 } });
    assert.equal(inventory.quantity, 13);
    const expectedAverage = (10 * 2 + 3 * 3.33) / 13;
    assert.ok(Math.abs(inventory.averageCost.toNumber() - expectedAverage) < 1e-9, inventory.averageCost.toString());
    assert.equal(await stockOf(v2), 0);

    const lots = await prisma.inventoryLot.findMany({ where: { productVariantId: v1 } });
    assert.equal(lots.length, 1);
    const [lot] = lots;
    assert.equal(lot.purchaseItemId, itemA.id);
    assert.equal(lot.sourceType, "PURCHASE");
    assert.equal(lot.sourceId, purchase.id);
    assert.equal(lot.batchNumber, batch);
    assert.equal(lot.initialQuantity, 3);
    assert.equal(lot.remainingQuantity, 3);
    assert.equal(lot.unitCost.toNumber(), 3.33);
    assert.equal(lot.manufacturingDate?.toISOString().slice(0, 10), "2026-01-15");
    assert.equal(lot.expirationDate?.toISOString().slice(0, 10), "2027-01-15");

    const movements = await prisma.stockMovement.findMany({ where: { productVariantId: v1 } });
    assert.equal(movements.length, 1);
    const [m] = movements;
    assert.equal(m.type, "IN");
    assert.equal(m.origin, "PURCHASE");
    assert.equal(m.originId, purchase.id);
    assert.equal(m.userId, admin.id);
    assert.equal(m.inventoryLotId, lot.id);
    assert.deepEqual([m.quantity, m.previousQuantity, m.currentQuantity], [3, 10, 13]);

    const row = await prisma.purchaseItem.findUniqueOrThrow({ where: { id: itemA.id } });
    assert.equal(row.receivedQuantity, 3);
  });

  test("receber o restante → RECEIVED; receber de novo → 409 PURCHASE_ALREADY_RECEIVED", async () => {
    const v1 = await freshVariant();
    const v2 = await freshVariant();
    const purchase = await createPurchase([
      { productVariantId: v1, quantity: 5, unitPrice: 2 },
      { productVariantId: v2, quantity: 2, unitPrice: 3 },
    ]);
    const a = itemOf(purchase, v1);
    const b = itemOf(purchase, v2);
    const batch = `tx-test-${randomUUID().slice(0, 8)}`;

    const first = await receive(purchase.id, [{ purchaseItemId: a.id, quantity: 2, batchNumber: batch }]);
    assert.equal(first.statusCode, 201, first.body);

    // Mesmo lote do mesmo item: soma no lote existente.
    const rest = await receive(purchase.id, [
      { purchaseItemId: b.id, quantity: 2 },
      { purchaseItemId: a.id, quantity: 3, batchNumber: batch },
    ]);
    assert.equal(rest.statusCode, 201, rest.body);
    const { data } = rest.json();
    assert.equal(data.status, "RECEIVED");
    assert.deepEqual(data.items.map((i: any) => i.remainingQuantity), [0, 0]);
    assert.equal(await stockOf(v1), 5);
    assert.equal(await stockOf(v2), 2);
    const lotsA = await prisma.inventoryLot.findMany({ where: { productVariantId: v1 } });
    assert.deepEqual(lotsA.map((l) => [l.batchNumber, l.initialQuantity, l.purchaseItemId]), [[batch, 5, a.id]]);
    assert.equal(await prisma.stockMovement.count({ where: { originId: purchase.id, origin: "PURCHASE" } }), 3);

    const again = await receive(purchase.id, [{ purchaseItemId: a.id, quantity: 1 }]);
    assert.equal(again.statusCode, 409);
    assert.deepEqual(again.json(), { message: "Pedido já foi totalmente recebido.", code: "PURCHASE_ALREADY_RECEIVED" });

    const row = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.equal(row.status, "RECEIVED");

    // Número de lote já usado por outro item de compra da mesma variante → 409 e nada gravado.
    const other = await createPurchase([{ productVariantId: v1, quantity: 1, unitPrice: 9 }]);
    const clash = await receive(other.id, [{ purchaseItemId: other.items[0].id, quantity: 1, batchNumber: batch }]);
    assert.equal(clash.statusCode, 409, clash.body);
    assert.deepEqual(clash.json(), {
      message: "Já existe um lote com esse número para esta variante.",
      code: "BATCH_ALREADY_EXISTS",
    });
    assert.equal(await stockOf(v1), 5);
    assert.equal((await prisma.purchase.findUniqueOrThrow({ where: { id: other.id } })).status, "PENDING");
  });

  test("quantidade acima do restante → 422 RECEIPT_EXCEEDS_REMAINING; item de outro pedido → 404", async () => {
    const v1 = await freshVariant();
    const purchase = await createPurchase([{ productVariantId: v1, quantity: 3, unitPrice: 2 }]);
    const other = await createPurchase([{ productVariantId: v1, quantity: 3, unitPrice: 2 }]);
    const itemId = purchase.items[0].id;

    const exceeds = await receive(purchase.id, [{ purchaseItemId: itemId, quantity: 4 }]);
    assert.equal(exceeds.statusCode, 422);
    assert.deepEqual(exceeds.json(), {
      message: "Quantidade maior que o saldo a receber do item.",
      code: "RECEIPT_EXCEEDS_REMAINING",
    });

    const foreign = await receive(purchase.id, [{ purchaseItemId: other.items[0].id, quantity: 1 }]);
    assert.equal(foreign.statusCode, 404);
    assert.deepEqual(foreign.json(), { message: "Item do pedido não encontrado.", code: "PURCHASE_ITEM_NOT_FOUND" });

    const missing = await receive(randomUUID(), [{ purchaseItemId: itemId, quantity: 1 }]);
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().code, "PURCHASE_NOT_FOUND");

    const ok = { purchaseItemId: itemId, quantity: 1 };
    const invalid: [string, object][] = [
      ["sem itens", { items: [] }],
      ["sem corpo", {}],
      ["item repetido", { items: [ok, ok] }],
      ["quantidade 0", { items: [{ ...ok, quantity: 0 }] }],
      ["quantidade fracionária", { items: [{ ...ok, quantity: 1.5 }] }],
      ["item inválido", { items: [{ ...ok, purchaseItemId: "x" }] }],
      ["lote longo", { items: [{ ...ok, batchNumber: "x".repeat(61) }] }],
      ["data inválida", { items: [{ ...ok, expirationDate: "2027-02-30" }] }],
      ["formato de data", { items: [{ ...ok, manufacturingDate: "15/01/2026" }] }],
      [
        "validade antes da fabricação",
        { items: [{ ...ok, manufacturingDate: "2026-05-01", expirationDate: "2026-04-30" }] },
      ],
    ];
    for (const [label, payload] of invalid) {
      const res = await call("POST", `/purchases/${purchase.id}/receipts`, admin, payload);
      assert.equal(res.statusCode, 400, `${label}: ${res.body}`);
    }
    const badId = await call("POST", "/purchases/nao-uuid/receipts", admin, { items: [ok] });
    assert.equal(badId.statusCode, 400);

    // Nada recebido em nenhum dos casos.
    assert.equal(await stockOf(v1), 0);
    const row = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id }, include: { items: true } });
    assert.equal(row.status, "PENDING");
    assert.equal(row.items[0].receivedQuantity, 0);
  });

  test("dois recebimentos simultâneos que juntos excedem → um 201 e um 422; estoque = pedido", async () => {
    const v1 = await freshVariant();
    const purchase = await createPurchase([{ productVariantId: v1, quantity: 5, unitPrice: 2 }]);
    const itemId = purchase.items[0].id;

    const results = await Promise.all([
      receive(purchase.id, [{ purchaseItemId: itemId, quantity: 3 }]),
      receive(purchase.id, [{ purchaseItemId: itemId, quantity: 3 }], estoquista),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 422], results.map((r) => r.body).join(" | "));
    assert.equal(results.find((r) => r.statusCode === 422)!.json().code, "RECEIPT_EXCEEDS_REMAINING");
    assert.equal(await stockOf(v1), 3);
    assert.equal((await prisma.purchaseItem.findUniqueOrThrow({ where: { id: itemId } })).receivedQuantity, 3);

    // O restante fecha exatamente o pedido.
    const rest = await receive(purchase.id, [{ purchaseItemId: itemId, quantity: 2 }]);
    assert.equal(rest.statusCode, 201, rest.body);
    assert.equal(rest.json().data.status, "RECEIVED");
    assert.equal(await stockOf(v1), 5);
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: v1 } }), 2);
  });

  test("cancelamento e recebimento simultâneos → exatamente um conclui", async () => {
    const v1 = await freshVariant();
    for (let round = 0; round < 3; round++) {
      const purchase = await createPurchase([{ productVariantId: v1, quantity: 2, unitPrice: 4 }]);
      const stockBefore = await stockOf(v1);
      const [receipt, cancel] = await Promise.all([
        receive(purchase.id, [{ purchaseItemId: purchase.items[0].id, quantity: 1 }]),
        call("POST", `/purchases/${purchase.id}/cancel`, admin, { reason: "Corrida de teste" }),
      ]);
      const row = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id }, include: { items: true } });
      const doc = await prisma.financialDocument.findFirstOrThrow({
        where: { originType: "PURCHASE", originId: purchase.id },
      });
      if (receipt.statusCode === 201) {
        assert.equal(cancel.statusCode, 409, cancel.body);
        assert.equal(cancel.json().code, "PURCHASE_HAS_RECEIPTS");
        assert.equal(row.status, "PARTIALLY_RECEIVED");
        assert.equal(row.items[0].receivedQuantity, 1);
        assert.equal(doc.status, "OPEN");
        assert.equal(await stockOf(v1), stockBefore + 1);
      } else {
        assert.equal(cancel.statusCode, 200, cancel.body);
        assert.equal(receipt.statusCode, 409, receipt.body);
        assert.deepEqual(receipt.json(), { message: "Pedido cancelado não pode ser recebido.", code: "PURCHASE_CANCELED" });
        assert.equal(row.status, "CANCELED");
        assert.equal(row.items[0].receivedQuantity, 0);
        assert.equal(doc.status, "CANCELED");
        assert.equal(await stockOf(v1), stockBefore);
        assert.equal(await prisma.inventoryLot.count({ where: { purchaseItemId: purchase.items[0].id } }), 0);
      }
    }
  });

  test("pedido cancelado → 409 PURCHASE_CANCELED; ESTOQUISTA pode receber; VENDEDOR não", async () => {
    const v1 = await freshVariant();
    const canceled = await createPurchase([{ productVariantId: v1, quantity: 2, unitPrice: 4 }]);
    const cancel = await call("POST", `/purchases/${canceled.id}/cancel`, admin, { reason: "Pedido errado" });
    assert.equal(cancel.statusCode, 200, cancel.body);
    const res = await receive(canceled.id, [{ purchaseItemId: canceled.items[0].id, quantity: 1 }], estoquista);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.json(), { message: "Pedido cancelado não pode ser recebido.", code: "PURCHASE_CANCELED" });

    const purchase = await createPurchase([{ productVariantId: v1, quantity: 2, unitPrice: 4 }]);
    const denied = await receive(purchase.id, [{ purchaseItemId: purchase.items[0].id, quantity: 1 }], vendedor);
    assert.equal(denied.statusCode, 403);

    const ok = await receive(purchase.id, [{ purchaseItemId: purchase.items[0].id, quantity: 2 }], estoquista);
    assert.equal(ok.statusCode, 201, ok.body);
    assert.equal(ok.json().data.status, "RECEIVED");
    assert.equal(ok.json().data.payable, null);
    const m = await prisma.stockMovement.findFirstOrThrow({ where: { originId: purchase.id } });
    assert.equal(m.userId, estoquista.id);
    assert.equal(await stockOf(v1), 2);
  });

  test("entrada manual (POST /inventory/receive) num lote ligado a item de compra → 409 BATCH_ALREADY_EXISTS sem alterar saldo", async () => {
    const v1 = await freshVariant();
    const purchase = await createPurchase([{ productVariantId: v1, quantity: 5, unitPrice: 4 }]);
    const batch = `tx-test-${randomUUID().slice(0, 8)}`;
    const ok = await receive(purchase.id, [{ purchaseItemId: purchase.items[0].id, quantity: 2, batchNumber: batch }]);
    assert.equal(ok.statusCode, 201, ok.body);

    const res = await call("POST", "/inventory/receive", admin, {
      productVariantId: v1,
      quantity: 3,
      unitCost: 1,
      batchNumber: batch,
      origin: "MANUAL",
      sourceType: "MANUAL",
    });
    assert.equal(res.statusCode, 409, res.body);
    assert.deepEqual(res.json(), {
      message: "Já existe um lote com esse número para esta variante.",
      code: "BATCH_ALREADY_EXISTS",
    });
    assert.equal(await stockOf(v1), 2);
    const lot = await prisma.inventoryLot.findFirstOrThrow({ where: { productVariantId: v1, batchNumber: batch } });
    assert.equal(lot.initialQuantity, 2);
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: v1 } }), 1);
  });
});
