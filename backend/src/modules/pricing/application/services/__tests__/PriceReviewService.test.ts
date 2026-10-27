import "dotenv/config";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { acquirePricingTestLock } from "../../../../../test/pricingTestLock";
import { makePriceReviewService } from "@pricing/infrastructure/factories/PriceReviewFactories";

const ZERO_FEES = { debitBps: 0, creditBps: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 0])) };

describe("PriceReviewService (gatilho dentro da transação)", () => {
  const tm = new PrismaTransactionManager();
  const service = makePriceReviewService();
  let variantId: string;
  let cleanup: () => Promise<void>;
  let releaseLock: () => Promise<void>;

  const pending = () => prisma.priceReview.findMany({ where: { productVariantId: variantId, status: "PENDING" } });

  const configure = async () => {
    await prisma.pricingSettings.create({
      data: { id: "default", defaultMarginBps: 3000, alertThresholdBps: 200, cardFees: ZERO_FEES },
    });
    await prisma.pricingExpense.create({ data: { name: "Despesas", percentBps: 2000 } });
  };

  before(async () => {
    releaseLock = await acquirePricingTestLock();
    ({ variantId, cleanup } = await createTestVariant());
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 30 } });
    await prisma.inventory.create({ data: { productVariantId: variantId, quantity: 1, averageCost: 12 } });
  });

  beforeEach(async () => {
    await prisma.priceReview.deleteMany({ where: { productVariantId: variantId } });
    await prisma.pricingExpense.deleteMany({});
    await prisma.pricingSettings.deleteMany({});
  });

  after(async () => {
    try {
      await prisma.pricingExpense.deleteMany({});
      await prisma.pricingSettings.deleteMany({});
      await cleanup();
    } finally {
      await releaseLock?.();
      await prisma.$disconnect();
    }
  });

  test("não configurado → costChanged não cria nada", async () => {
    await tm.execute(() => service.costChanged(variantId));
    assert.equal((await pending()).length, 0);
  });

  test("rollback da transação do gatilho → sem revisão", async () => {
    await configure();
    await assert.rejects(
      tm.execute(async () => {
        await service.costChanged(variantId);
        throw new Error("falha depois do gatilho");
      }),
      /falha depois do gatilho/,
    );
    assert.equal((await pending()).length, 0);
  });

  test("gatilhos simultâneos em transações separadas (sem trava de inventário) → uma única PENDING, sem erro (2×)", async () => {
    await configure();
    for (let round = 0; round < 2; round++) {
      await prisma.priceReview.deleteMany({ where: { productVariantId: variantId } });
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => tm.execute(() => service.costChanged(variantId))),
      );
      for (const r of results) assert.equal(r.status, "fulfilled", String((r as PromiseRejectedResult).reason));
      const rows = await pending();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].reason, "COST_CHANGED");
      assert.equal(Number(rows[0].suggestedPrice), 24.9);
    }
  });

  test("custo volta ao ponto em que o preço é o sugerido → pendente antiga sai", async () => {
    await configure();
    await tm.execute(() => service.costChanged(variantId));
    assert.equal((await pending()).length, 1);
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 24.9 } });
    await tm.execute(() => service.costChanged(variantId));
    assert.equal((await pending()).length, 0);
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 30 } });
  });
});
