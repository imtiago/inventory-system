import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { createTestVariant } from "../../test/inventoryFixtures";
import { mergeCountLots, parseMergeCountLotsArgs } from "../mergeCountLots";

describe("merge-count-lots", () => {
  let cleanupVariant: () => Promise<void>;
  let variantId: string;
  let inventoryId: string;
  let boxA: { id: string; code: string };
  let boxB: { id: string; code: string };
  let countLots: string[];
  let loneCountLot: string;
  let purchaseLot: string;
  let batchLot: string;
  let manualLot: string;
  const boxIds: string[] = [];

  /** Dado legado: 3 lotes de contagem de 1 unidade (custos 2, 4, 6) na caixa A + lotes que não podem ser tocados. */
  beforeEach(async () => {
    const created = await createTestVariant();
    cleanupVariant = created.cleanup;
    variantId = created.variantId;
    inventoryId = (await prisma.inventory.create({ data: { productVariantId: variantId, quantity: 7 } })).id;
    const newBox = async () => {
      const box = await prisma.inventoryBox.create({ data: { code: `tx-test-${randomUUID()}` } });
      boxIds.push(box.id);
      return box;
    };
    [boxA, boxB] = [await newBox(), await newBox()];
    const day = (d: number) => new Date(Date.UTC(2020, 0, d));
    const lot = async (
      day_: number,
      over: Record<string, unknown> = {},
      box?: { id: string },
      origin: "INVENTORY" | "MANUAL" = "INVENTORY",
    ) => {
      const l = await prisma.inventoryLot.create({
        data: {
          inventoryId,
          productVariantId: variantId,
          sourceType: "MANUAL",
          initialQuantity: 1,
          remainingQuantity: 1,
          unitCost: 2,
          createdAt: day(day_),
          ...over,
        } as never,
      });
      if (box) await prisma.inventoryBoxStock.create({ data: { inventoryLotId: l.id, boxId: box.id, quantity: 1 } });
      await prisma.stockMovement.create({
        data: { inventoryId, productVariantId: variantId, inventoryLotId: l.id, type: "IN", origin, quantity: 1 },
      });
      return l.id;
    };
    countLots = [
      await lot(3, { unitCost: 6 }, boxA),
      await lot(1, { unitCost: 2 }, boxA),
      await lot(2, { unitCost: 4 }, boxA),
    ];
    loneCountLot = await lot(4, {}, boxB);
    purchaseLot = await lot(5, { sourceType: "PURCHASE" }, boxA);
    batchLot = await lot(6, { batchNumber: `tx-test-${randomUUID().slice(0, 8)}` }, boxA);
    manualLot = await lot(7, {}, boxA, "MANUAL");
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

  const lotsOf = () =>
    prisma.inventoryLot.findMany({ where: { productVariantId: variantId }, orderBy: { id: "asc" } });
  const stocksOf = () =>
    prisma.inventoryBoxStock.findMany({ where: { inventoryLot: { productVariantId: variantId } }, orderBy: { id: "asc" } });
  const movementsOf = () =>
    prisma.stockMovement.findMany({ where: { productVariantId: variantId }, orderBy: { id: "asc" } });

  test("simulação relata o que uniria e não altera nada", async () => {
    const [lots, stocks, movements] = [await lotsOf(), await stocksOf(), await movementsOf()];
    const lines: string[] = [];

    const result = await mergeCountLots({ apply: false, variantIds: [variantId], log: (l) => lines.push(l) });

    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].survivorId, countLots[1]); // o mais antigo
    assert.deepEqual([...result.groups[0].mergedIds].sort(), [countLots[0], countLots[2]].sort());
    assert.equal(result.groups[0].quantity, 3);
    assert.ok(lines.some((l) => l.includes("dry-run")), lines.join("\n"));
    assert.deepEqual(await lotsOf(), lots);
    assert.deepEqual(await stocksOf(), stocks);
    assert.deepEqual(await movementsOf(), movements);
  });

  test("--apply une no lote mais antigo preservando somas, alocações e histórico; não toca os demais", async () => {
    const sumRemaining = async () => (await lotsOf()).reduce((s, l) => s + l.remainingQuantity, 0);
    const totalBefore = await sumRemaining();
    const movementsBefore = await movementsOf();

    await mergeCountLots({ apply: true, variantIds: [variantId], log: () => {} });

    const lots = await lotsOf();
    assert.deepEqual(
      lots.map((l) => l.id).sort(),
      [countLots[1], loneCountLot, purchaseLot, batchLot, manualLot].sort(),
    );
    assert.equal(await sumRemaining(), totalBefore);
    const survivor = lots.find((l) => l.id === countLots[1])!;
    assert.equal(survivor.initialQuantity, 3);
    assert.equal(survivor.remainingQuantity, 3);
    assert.equal(Number(survivor.unitCost), 4); // média ponderada de 2, 4 e 6
    assert.equal(survivor.batchNumber, `CONT-${boxA.code}-${(await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).code}`);
    const stockOf = async (lotId: string, boxId: string) =>
      (await stocksOf()).filter((s) => s.inventoryLotId === lotId && s.boxId === boxId).map((s) => s.quantity);
    assert.deepEqual(await stockOf(survivor.id, boxA.id), [3]);
    // Σ alocações por caixa preservada.
    const perBox = (rows: { boxId: string; quantity: number }[]) =>
      Object.fromEntries([boxA.id, boxB.id].map((b) => [b, rows.filter((r) => r.boxId === b).reduce((s, r) => s + r.quantity, 0)]));
    assert.deepEqual(perBox(await stocksOf()), { [boxA.id]: 3 + 1 + 1 + 1, [boxB.id]: 1 });
    // Histórico: nenhuma movimentação perdida; as dos lotes unidos agora apontam para o sobrevivente.
    const movementsAfter = await movementsOf();
    assert.equal(movementsAfter.length, movementsBefore.length);
    assert.equal(movementsAfter.filter((m) => m.inventoryLotId === countLots[1]).length, 3);
    // Lotes fora do critério intactos (compra, com lote informado, entrada manual não-contagem, caixa com um só lote).
    for (const id of [purchaseLot, batchLot, manualLot, loneCountLot]) {
      assert.equal(lots.find((l) => l.id === id)!.initialQuantity, 1);
    }
  });

  test("é idempotente: segunda execução não encontra nada", async () => {
    await mergeCountLots({ apply: true, variantIds: [variantId], log: () => {} });
    const [lots, stocks, movements] = [await lotsOf(), await stocksOf(), await movementsOf()];
    const lines: string[] = [];

    const second = await mergeCountLots({ apply: true, variantIds: [variantId], log: (l) => lines.push(l) });

    assert.deepEqual(second.groups, []);
    assert.ok(lines.some((l) => l.includes("Nenhum lote de contagem")), lines.join("\n"));
    assert.deepEqual(await lotsOf(), lots);
    assert.deepEqual(await stocksOf(), stocks);
    assert.deepEqual(await movementsOf(), movements);
  });

  test("argumentos: padrão é simulação; --apply grava; combinações inválidas falham", () => {
    assert.deepEqual(parseMergeCountLotsArgs([]), { apply: false });
    assert.deepEqual(parseMergeCountLotsArgs(["--dry-run"]), { apply: false });
    assert.deepEqual(parseMergeCountLotsArgs(["--apply"]), { apply: true });
    assert.throws(() => parseMergeCountLotsArgs(["--apply", "--dry-run"]));
    assert.throws(() => parseMergeCountLotsArgs(["--force"]));
  });
});
