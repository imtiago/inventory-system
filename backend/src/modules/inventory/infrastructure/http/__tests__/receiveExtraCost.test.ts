import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

describe("Entrada manual com despesa (extraCost)", () => {
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let token: string;

  beforeEach(async () => {
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    token = signTestToken(await getTestUserId());
  });
  afterEach(async () => {
    await cleanupVariant();
  });
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const receive = (over: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/inventory/receive",
      headers: withIdempotencyKey("POST", { authorization: `Bearer ${token}` }),
      payload: { productVariantId: variantId, quantity: 3, unitCost: 10, origin: "MANUAL", ...over } as any,
    });

  test("3 un, custo 10,00, extraCost 1,00 → unitCost do lote 10,3333 e acquisitionExtraCost 0,3333; custo médio usa 10,3333", async () => {
    const res = await receive({ extraCost: 1, batchNumber: "EX-1" });
    assert.equal(res.statusCode, 200, res.body);
    const lot = await prisma.inventoryLot.findFirstOrThrow({ where: { productVariantId: variantId } });
    assert.equal(lot.unitCost.toNumber(), 10.3333);
    assert.equal(lot.acquisitionExtraCost.toNumber(), 0.3333);
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: variantId } });
    assert.equal(inventory.averageCost.toNumber(), 10.3333);
  });

  test("sem extraCost: lote como antes (acquisitionExtraCost 0, custo exato)", async () => {
    assert.equal((await receive({ batchNumber: "EX-0" })).statusCode, 200);
    const lot = await prisma.inventoryLot.findFirstOrThrow({ where: { productVariantId: variantId } });
    assert.deepEqual([lot.unitCost.toNumber(), lot.acquisitionExtraCost.toNumber()], [10, 0]);
  });

  test("mesmo lote existente: acquisitionExtraCost ponderado pelo saldo (4 casas)", async () => {
    assert.equal((await receive({ extraCost: 1, batchNumber: "EX-2" })).statusCode, 200); // 3 un, 0,3333
    assert.equal((await receive({ quantity: 1, extraCost: 2, batchNumber: "EX-2" })).statusCode, 200); // 1 un, 2,0000
    const lot = await prisma.inventoryLot.findFirstOrThrow({ where: { productVariantId: variantId } });
    // (3 × 0,3333 + 1 × 2) / 4 = 0,7500 (0,749975 → 0,75); custo: (3 × 10,3333 + 12) / 4 = 10,7500
    assert.equal(lot.acquisitionExtraCost.toNumber(), 0.75);
    assert.equal(lot.unitCost.toNumber(), 10.75);
    assert.equal(lot.initialQuantity, 4);
  });

  test("extraCost negativo ou com 3 casas → 400", async () => {
    for (const extraCost of [-1, 1.005]) {
      const res = await receive({ extraCost });
      assert.equal(res.statusCode, 400, res.body);
      assert.deepEqual(res.json().errors.map((e: any) => e.field), ["extraCost"]);
    }
    assert.equal(await prisma.inventoryLot.count({ where: { productVariantId: variantId } }), 0);
  });
});
