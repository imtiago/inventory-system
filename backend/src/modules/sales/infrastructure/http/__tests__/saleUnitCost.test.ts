import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

describe("Custo unitário gravado na venda", () => {
  let token: string;
  let customerId: string;
  const variants: { cleanup: () => Promise<void> }[] = [];

  const request = (method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: withIdempotencyKey(method, { authorization: `Bearer ${token}` }),
    });

  const receiveLot = async (variantId: string, quantity: number, unitCost: number) => {
    const res = await request("POST", "/inventory/lots", {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity,
      unitCost,
      expirationDate: "2030-06-30T00:00:00.000Z",
    });
    assert.equal(res.statusCode, 200, res.body);
  };

  const createVariant = async (lots: [number, number][]) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ cleanup });
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 30 } });
    for (const [quantity, unitCost] of lots) await receiveLot(variantId, quantity, unitCost);
    return variantId;
  };

  const sell = async (variantId: string, quantity = 1) => {
    const res = await request("POST", "/sales", {
      customerId,
      items: [{ productVariantId: variantId, quantity }],
      paymentTerms: { installments: 1 },
    });
    assert.equal(res.statusCode, 201, res.body);
    return res.json().data.id as string;
  };

  const storedCost = async (saleId: string) => {
    const items = await prisma.saleItem.findMany({ where: { saleId } });
    assert.equal(items.length, 1);
    return items[0].unitCost === null ? null : items[0].unitCost.toString();
  };

  beforeEach(async () => {
    token = signTestToken(await getTestUserId());
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  afterEach(async () => {
    const id = customerId;
    const toClean = variants.splice(0);
    try {
      await deleteFinancialDocuments({ where: { partyId: id } });
    } finally {
      await prisma.sale.deleteMany({ where: { customerId: id } });
      for (const v of toClean) await v.cleanup();
      await prisma.customer.deleteMany({ where: { id } });
    }
  });

  after(async () => {
    try {
      await app.close();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("venda grava unitCost = custo médio da variante no momento (10,3333)", async () => {
    const v = await createVariant([[2, 10], [1, 11]]);
    const saleId = await sell(v);
    assert.equal(await storedCost(saleId), "10.3333");
  });

  test("custo médio muda depois → o custo da venda antiga não muda", async () => {
    const v = await createVariant([[5, 10]]);
    const saleId = await sell(v);
    await receiveLot(v, 5, 20); // média passa a ~15
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: v } });
    assert.notEqual(Number(inv.averageCost), 10);
    assert.equal(await storedCost(saleId), "10");
  });

  test("variante com inventário de custo 0 → unitCost 0 (não NULL)", async () => {
    const v = await createVariant([[3, 0]]);
    const saleId = await sell(v);
    assert.equal(await storedCost(saleId), "0");
  });

  test("GET /sales/:id não expõe unitCost", async () => {
    const v = await createVariant([[3, 4]]);
    const saleId = await sell(v);
    const res = await request("GET", `/sales/${saleId}`);
    assert.equal(res.statusCode, 200, res.body);
    assert.ok(!res.body.includes("unitCost"));
    assert.ok(!res.body.includes("Cost"));
  });
});
