import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { createTestVariant } from "../../test/inventoryFixtures";
import { fixBoxStock, parseFixBoxStockArgs } from "../fixBoxStock";

describe("fix-box-stock", () => {
  let cleanupVariant: () => Promise<void>;
  let divergentLot: string;
  let healthyLot: string;
  let older: string;
  let newer: string;
  let healthyBox: string;
  const boxIds: string[] = [];

  /** Dado legado: lote com saldo 3 e 9 alocados (4 na caixa antiga, 5 na nova). */
  beforeEach(async () => {
    const created = await createTestVariant();
    cleanupVariant = created.cleanup;
    const productVariantId = created.variantId;
    const inventory = await prisma.inventory.create({ data: { productVariantId, quantity: 13 } });
    const lotData = (remainingQuantity: number) => ({
      inventoryId: inventory.id,
      productVariantId,
      sourceType: "MANUAL" as const,
      initialQuantity: 10,
      remainingQuantity,
      unitCost: 1,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
    });
    divergentLot = (await prisma.inventoryLot.create({ data: lotData(3) })).id;
    healthyLot = (await prisma.inventoryLot.create({ data: lotData(10) })).id;
    const box = async () => {
      const id = (await prisma.inventoryBox.create({ data: { code: `tx-test-${randomUUID()}` } })).id;
      boxIds.push(id);
      return id;
    };
    [older, newer, healthyBox] = [await box(), await box(), await box()];
    const day = (d: number) => new Date(Date.UTC(2020, 0, d));
    await prisma.inventoryBoxStock.createMany({
      data: [
        { inventoryLotId: divergentLot, boxId: newer, quantity: 5, createdAt: day(2) },
        { inventoryLotId: divergentLot, boxId: older, quantity: 4, createdAt: day(1) },
        { inventoryLotId: healthyLot, boxId: healthyBox, quantity: 2, createdAt: day(1) },
      ],
    });
  });

  afterEach(async () => {
    const ids = boxIds.splice(0);
    try {
      await cleanupVariant();
    } finally {
      await prisma.inventoryBox.deleteMany({ where: { id: { in: ids } } });
    }
  });

  after(async () => {
    await prisma.$disconnect();
  });

  const allocations = async () =>
    (
      await prisma.inventoryBoxStock.findMany({
        where: { inventoryLotId: { in: [divergentLot, healthyLot] } },
        orderBy: [{ inventoryLotId: "asc" }, { createdAt: "asc" }],
      })
    ).map((a) => [a.inventoryLotId, a.boxId, a.quantity]);

  test("dry-run relata a divergência sem gravar nada", async () => {
    const before = await prisma.inventoryBoxStock.findMany({
      where: { inventoryLotId: { in: [divergentLot, healthyLot] } },
      orderBy: { id: "asc" },
    });
    const lines: string[] = [];

    const result = await fixBoxStock({ apply: false, lotIds: [divergentLot, healthyLot], log: (l) => lines.push(l) });

    assert.deepEqual(
      result.lots.map((l) => [l.inventoryLotId, l.remainingQuantity, l.allocatedQuantity]),
      [[divergentLot, 3, 9]],
    );
    assert.deepEqual(
      result.changes.map((c) => [c.boxId, c.previousQuantity, c.quantity]),
      [
        [older, 4, 0],
        [newer, 5, 3],
      ],
    );
    assert.ok(lines.some((l) => l.includes("dry-run")), lines.join("\n"));
    assert.ok(lines.some((l) => l.includes(divergentLot)), lines.join("\n"));
    assert.ok(!lines.some((l) => l.includes(healthyLot)), lines.join("\n"));
    const afterRows = await prisma.inventoryBoxStock.findMany({
      where: { inventoryLotId: { in: [divergentLot, healthyLot] } },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(afterRows, before);
  });

  test("apply corrige (mais antigas primeiro) e uma segunda execução não muda nada", async () => {
    const first = await fixBoxStock({ apply: true, lotIds: [divergentLot, healthyLot], log: () => {} });
    assert.deepEqual(
      first.changes.map((c) => [c.boxId, c.previousQuantity, c.quantity]),
      [
        [older, 4, 0],
        [newer, 5, 3],
      ],
    );
    const expected = [
      [divergentLot, newer, 3],
      [healthyLot, healthyBox, 2],
    ].sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
    assert.deepEqual(await allocations(), expected);
    // Saldo dos lotes intacto: o script só mexe nas alocações.
    const lots = await prisma.inventoryLot.findMany({ where: { id: { in: [divergentLot, healthyLot] } } });
    assert.deepEqual(lots.map((l) => l.remainingQuantity).sort(), [10, 3]);

    const lines: string[] = [];
    const second = await fixBoxStock({ apply: true, lotIds: [divergentLot, healthyLot], log: (l) => lines.push(l) });
    assert.deepEqual(second.lots, []);
    assert.deepEqual(second.changes, []);
    assert.ok(lines.some((l) => l.includes("Nenhuma alocação acima do saldo")), lines.join("\n"));
    assert.deepEqual(await allocations(), expected);
  });

  test("argumentos: padrão é dry-run; --apply grava; combinações inválidas falham", () => {
    assert.deepEqual(parseFixBoxStockArgs([]), { apply: false });
    assert.deepEqual(parseFixBoxStockArgs(["--dry-run"]), { apply: false });
    assert.deepEqual(parseFixBoxStockArgs(["--apply"]), { apply: true });
    assert.throws(() => parseFixBoxStockArgs(["--apply", "--dry-run"]));
    assert.throws(() => parseFixBoxStockArgs(["--force"]));
  });
});
