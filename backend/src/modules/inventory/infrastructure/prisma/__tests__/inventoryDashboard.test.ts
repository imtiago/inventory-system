import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { runInTransactionContext } from "@shared/infrastructure/prisma/transactionContext";
import { PrismaInventoryReadRepository } from "../contracts/PrismaInventoryReadRepository";
import { createTestVariant } from "../../../../../test/inventoryFixtures";

const cleanups: Array<() => Promise<void>> = [];

after(async () => {
  for (const cleanup of cleanups) await cleanup();
  await prisma.$disconnect();
});

test("dashboard de estoque agregado no SQL bate com o cálculo em memória (mesmo snapshot)", async () => {
  // Casos: esgotado, baixo, normal e com reserva; custos com 4 casas.
  const specs = [
    { quantity: 0, reserved: 0, minimum: 5, cost: "2.5000" },
    { quantity: 4, reserved: 0, minimum: 5, cost: "3.3333" },
    { quantity: 10, reserved: 3, minimum: 5, cost: "10.2938" },
    { quantity: 10, reserved: 10, minimum: 0, cost: "1.0000" },
    { quantity: 50, reserved: 0, minimum: 5, cost: "0.0100" },
  ];
  for (const spec of specs) {
    const { variantId, cleanup } = await createTestVariant();
    cleanups.push(cleanup);
    await prisma.inventory.create({
      data: {
        productVariantId: variantId,
        quantity: spec.quantity,
        reservedQuantity: spec.reserved,
        minimumStock: spec.minimum,
        averageCost: spec.cost,
      },
    });
  }

  const { dashboard, rows } = await prisma.$transaction(
    async (tx) => {
      // O dashboard abre o snapshot; a leitura em memória vê exatamente os mesmos dados.
      const dashboard = await runInTransactionContext(tx, () => new PrismaInventoryReadRepository().getDashboard());
      const rows = await tx.inventory.findMany({
        select: { quantity: true, reservedQuantity: true, minimumStock: true, averageCost: true },
      });
      return { dashboard, rows };
    },
    { isolationLevel: "RepeatableRead" },
  );

  let totalQuantity = 0;
  let totalReserved = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let valueCents = 0n;
  let valueScaled = 0n; // custo com 4 casas × quantidade, em 1/10000
  for (const r of rows) {
    totalQuantity += r.quantity;
    totalReserved += r.reservedQuantity;
    const available = r.quantity - r.reservedQuantity;
    if (available <= 0) outOfStock++;
    else if (available <= r.minimumStock) lowStock++;
    valueScaled += BigInt(r.quantity) * BigInt(Math.round(Number(r.averageCost) * 10_000));
  }
  valueCents = (valueScaled + 50n) / 100n; // arredonda para centavos

  assert.equal(dashboard.totalProducts, rows.length);
  assert.equal(dashboard.totalQuantity, totalQuantity);
  assert.equal(dashboard.totalReserved, totalReserved);
  assert.equal(dashboard.totalAvailable, totalQuantity - totalReserved);
  assert.equal(dashboard.lowStock, lowStock);
  assert.equal(dashboard.outOfStock, outOfStock);
  assert.equal(Math.round(dashboard.totalStockValue * 100), Number(valueCents));
  assert.ok(lowStock >= 1 && outOfStock >= 2, "os casos criados cobrem baixo e esgotado");
});
