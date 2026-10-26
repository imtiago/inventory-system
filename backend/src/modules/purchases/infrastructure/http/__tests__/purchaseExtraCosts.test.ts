import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { randomCpf } from "../../../../../test/documentFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

type Item = { productVariantId: string; quantity: number; unitPrice: number; discount?: number; freight?: number };

describe("Despesas do pedido de compra (extraCosts) e custo de aquisição do lote", () => {
  let admin: TestUser;
  let supplierId: string;
  const variantCleanups: (() => Promise<void>)[] = [];
  const variantIds: string[] = [];
  const purchaseIds: string[] = [];

  const call = (method: "GET" | "POST", url: string, payload?: object) =>
    app.inject({ method, url, headers: withIdempotencyKey(method, { authorization: `Bearer ${admin.token}` }), payload });

  const freshVariant = async () => {
    const { variantId, cleanup } = await createTestVariant();
    variantIds.push(variantId);
    variantCleanups.push(cleanup);
    return variantId;
  };

  const create = (items: Item[], extraCosts?: number) =>
    call("POST", "/purchases", { supplierId, items, extraCosts, paymentTerms: { installments: 1 } });

  const created = async (items: Item[], extraCosts?: number) => {
    const res = await create(items, extraCosts);
    assert.equal(res.statusCode, 201, res.body);
    purchaseIds.push(res.json().data.id);
    return res.json().data;
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    supplierId = (await prisma.supplier.create({ data: { name: `tx-test-${randomUUID()}`, document: randomCpf() } })).id;
  });

  after(async () => {
    try {
      const documents = { originType: "PURCHASE" as const, originId: { in: purchaseIds } };
      await prisma.payment.deleteMany({ where: { parcel: { document: documents } } });
      await prisma.financialParcel.deleteMany({ where: { document: documents } });
      await deleteFinancialDocuments({ where: documents });
      await prisma.stockMovement.deleteMany({ where: { productVariantId: { in: variantIds } } });
      await prisma.inventoryLot.deleteMany({ where: { productVariantId: { in: variantIds } } });
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
      for (const cleanup of variantCleanups) await cleanup();
    } finally {
      await admin.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("extraCosts 10,00 e itens de 30,00/60,00/10,00 → frete +3,00/+6,00/+1,00; total do pedido e do contas a pagar sobem 10,00", async () => {
    const [a, b, c] = [await freshVariant(), await freshVariant(), await freshVariant()];
    const data = await created(
      [
        { productVariantId: a, quantity: 1, unitPrice: 30 },
        { productVariantId: b, quantity: 2, unitPrice: 30 },
        { productVariantId: c, quantity: 1, unitPrice: 10 },
      ],
      10,
    );
    const freightOf = (v: string) => data.items.find((i: any) => i.productVariant.id === v).freight;
    assert.deepEqual([freightOf(a), freightOf(b), freightOf(c)], [3, 6, 1]);
    assert.equal(data.totalAmount, 110);
    assert.equal(data.extraCosts, 10);
    assert.equal(data.payable.parcels.reduce((s: number, p: any) => s + p.amount, 0), 110);

    const row = await prisma.purchase.findUniqueOrThrow({ where: { id: data.id } });
    assert.equal(row.extraCosts.toNumber(), 10);
    assert.equal(row.totalAmount.toNumber(), 110);
  });

  test("R$ 10,00 em 3 itens de mesmo valor fecha exatamente (3,34/3,33/3,33); frete já informado soma ao rateio; desconto entra no peso", async () => {
    const [a, b, c] = [await freshVariant(), await freshVariant(), await freshVariant()];
    const data = await created(
      [
        { productVariantId: a, quantity: 1, unitPrice: 10 },
        { productVariantId: b, quantity: 1, unitPrice: 10, freight: 1 },
        { productVariantId: c, quantity: 1, unitPrice: 10 },
      ],
      10,
    );
    const freights = data.items.map((i: any) => i.freight);
    assert.deepEqual(freights, [3.34, 4.33, 3.33]);
    assert.equal(data.totalAmount, 41);

    const [d, e] = [await freshVariant(), await freshVariant()];
    const discounted = await created(
      [
        { productVariantId: d, quantity: 1, unitPrice: 20, discount: 10 },
        { productVariantId: e, quantity: 1, unitPrice: 10 },
      ],
      4,
    );
    assert.deepEqual(discounted.items.map((i: any) => i.freight), [2, 2]);
  });

  test("sem extraCosts o pedido é como antes (extraCosts 0)", async () => {
    const v = await freshVariant();
    const data = await created([{ productVariantId: v, quantity: 1, unitPrice: 5, freight: 1 }]);
    assert.equal(data.extraCosts, 0);
    assert.equal(data.items[0].freight, 1);
  });

  test("recebimento do pedido: lote com acquisitionExtraCost = (frete + imposto do item) / quantidade, 4 casas", async () => {
    const v = await freshVariant();
    // 3 un × 10,00 + 1,00 de despesa → frete 1,00; custo 31,00 / 3 = 10,3333; extra 1,00 / 3 = 0,3333.
    const data = await created([{ productVariantId: v, quantity: 3, unitPrice: 10 }], 1);
    const res = await call("POST", `/purchases/${data.id}/receipts`, {
      items: [{ purchaseItemId: data.items[0].id, quantity: 3 }],
    });
    assert.equal(res.statusCode, 201, res.body);
    const lot = await prisma.inventoryLot.findFirstOrThrow({ where: { productVariantId: v } });
    assert.equal(lot.unitCost.toNumber(), 10.3333);
    assert.equal(lot.acquisitionExtraCost.toNumber(), 0.3333);
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: v } });
    assert.equal(inventory.averageCost.toNumber(), 10.3333);
  });

  test("extraCosts negativo ou com 3 casas → 400", async () => {
    const v = await freshVariant();
    const items = [{ productVariantId: v, quantity: 1, unitPrice: 5 }];
    for (const extraCosts of [-1, 1.005]) {
      const res = await create(items, extraCosts);
      assert.equal(res.statusCode, 400, res.body);
      assert.deepEqual(res.json().errors.map((e: any) => e.field), ["extraCosts"]);
    }
  });
});
