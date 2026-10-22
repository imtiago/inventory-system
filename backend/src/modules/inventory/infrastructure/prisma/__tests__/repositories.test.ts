import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { PrismaInventoryRepository } from "../repositories/PrismaInventoryRepository";
import { PrismaInventoryLotRepository } from "../repositories/PrismaInventoryLotRepository";
import { PrismaInventoryBoxStockRepository } from "../repositories/PrismaInventoryBoxStockRepository";
import { PrismaStockMovementRepository } from "../repositories/PrismaStockMovementRepository";

describe("repositórios Prisma de estoque", () => {
  const inventoryRepo = new PrismaInventoryRepository();
  const lotRepo = new PrismaInventoryLotRepository();
  const boxStockRepo = new PrismaInventoryBoxStockRepository();
  const movementRepo = new PrismaStockMovementRepository();

  let variantId: string;
  let cleanup: () => Promise<void>;
  const boxIds: string[] = [];

  beforeEach(async () => {
    ({ variantId, cleanup } = await createTestVariant());
  });

  afterEach(async () => {
    await cleanup();
    await prisma.inventoryBox.deleteMany({ where: { id: { in: boxIds.splice(0) } } });
  });

  after(async () => {
    await prisma.inventoryBox.deleteMany({ where: { code: { startsWith: "tx-test-" } } });
    await prisma.user.deleteMany({ where: { email: "tx-test-inventory@local" } });
    await prisma.$disconnect();
  });

  const newInventory = (averageCost?: number) =>
    inventoryRepo.create(new Inventory({ productVariantId: variantId, averageCost }));

  const newLot = (inventoryId: string, over: Record<string, unknown> = {}) =>
    lotRepo.create(
      new InventoryLot({
        inventoryId,
        productVariantId: variantId,
        sourceType: InventoryLotSource.MANUAL,
        initialQuantity: 10,
        unitCost: 3.5,
        ...over,
      }),
    );

  const newBox = async () => {
    const box = await prisma.inventoryBox.create({ data: { code: `tx-test-${randomUUID()}` } });
    boxIds.push(box.id);
    return box.id;
  };

  test("Inventory persiste e recarrega averageCost", async () => {
    const created = await newInventory(12.5);
    const loaded = await inventoryRepo.findById(created.id);
    assert.equal(loaded?.averageCost, 12.5);

    loaded!.receive({ quantity: 2, unitCost: 20 });
    await inventoryRepo.update(loaded!);
    const reloaded = await inventoryRepo.findByProductVariantId(variantId);
    assert.equal(reloaded?.averageCost, loaded!.averageCost);
    assert.equal(reloaded?.quantity, 2);
  });

  test("InventoryLot round-trip initial/remaining", async () => {
    const inv = await newInventory();
    const created = await newLot(inv.id, { initialQuantity: 10, remainingQuantity: 4, batchNumber: "L1" });
    const loaded = await lotRepo.findById(created.id);
    assert.equal(loaded?.initialQuantity, 10);
    assert.equal(loaded?.remainingQuantity, 4);
    assert.equal(loaded?.unitCost, 3.5);
    assert.equal(loaded?.batchNumber, "L1");
    assert.equal(
      (await lotRepo.findByProductVariantIdAndBatchNumber(variantId, "L1"))?.id,
      created.id,
    );
  });

  test("findAvailableByInventory ignora lotes vazios e ordena FIFO", async () => {
    const inv = await newInventory();
    const second = await newLot(inv.id, { createdAt: new Date("2024-02-01") });
    const empty = await newLot(inv.id, { remainingQuantity: 0, createdAt: new Date("2024-01-15") });
    const first = await newLot(inv.id, { createdAt: new Date("2024-01-01") });

    const available = await lotRepo.findAvailableByInventory(inv.id);
    assert.deepEqual(available.map((l) => l.id), [first.id, second.id]);
    assert.ok(!available.some((l) => l.id === empty.id));
  });

  test("StockMovement persiste lote, saldos, custo, notes, originId", async () => {
    const inv = await newInventory();
    const lot = await newLot(inv.id);
    const userId = await getTestUserId();
    const originId = randomUUID();

    const created = await movementRepo.create(
      new StockMovement({
        inventoryId: inv.id,
        productVariantId: variantId,
        inventoryLotId: lot.id,
        type: StockMovementType.IN,
        origin: StockMovementOrigin.PURCHASE,
        quantity: 10,
        previousQuantity: 0,
        currentQuantity: 10,
        averageCost: 3.5,
        notes: "entrada",
        originId,
        userId,
      }),
    );
    const loaded = await movementRepo.findById(created.id);
    assert.equal(loaded?.inventoryLotId, lot.id);
    assert.equal(loaded?.previousQuantity, 0);
    assert.equal(loaded?.currentQuantity, 10);
    assert.equal(loaded?.averageCost, 3.5);
    assert.equal(loaded?.notes, "entrada");
    assert.equal(loaded?.originId, originId);
    assert.equal(loaded?.userId, userId);

    const edited = new StockMovement({
      id: created.id,
      inventoryId: inv.id,
      productVariantId: variantId,
      inventoryLotId: lot.id,
      type: StockMovementType.IN,
      origin: StockMovementOrigin.PURCHASE,
      quantity: 10,
      previousQuantity: 0,
      currentQuantity: 10,
      notes: "editado",
      userId,
      createdAt: created.createdAt,
    });
    await movementRepo.update(edited);
    assert.equal((await movementRepo.findById(created.id))?.notes, "editado");
  });

  test("StockMovement sem userId é gravado", async () => {
    const inv = await newInventory();
    const created = await movementRepo.create(
      new StockMovement({
        inventoryId: inv.id,
        productVariantId: variantId,
        type: StockMovementType.RESERVE,
        origin: StockMovementOrigin.SALE,
        quantity: 1,
        previousQuantity: 5,
        currentQuantity: 5,
      }),
    );
    const loaded = await movementRepo.findById(created.id);
    assert.equal(loaded?.userId, null);
    assert.equal(loaded?.inventoryLotId, null);
  });

  test("movimentação legada com saldos nulos carrega via findById", async () => {
    const inv = await newInventory();
    const row = await prisma.stockMovement.create({
      data: {
        inventoryId: inv.id,
        productVariantId: variantId,
        type: "IN",
        origin: "MANUAL",
        quantity: 5,
      },
    });
    const loaded = await movementRepo.findById(row.id);
    assert.equal(loaded?.previousQuantity, null);
    assert.equal(loaded?.currentQuantity, null);
    assert.equal(loaded?.quantity, 5);
  });

  test("InventoryBoxStock.findById inexistente retorna null", async () => {
    assert.equal(await boxStockRepo.findById(randomUUID()), null);
  });

  test("sumAllocatedByLot soma todas as caixas", async () => {
    const inv = await newInventory();
    const lot = await newLot(inv.id);
    const emptyLot = await newLot(inv.id);
    await boxStockRepo.create(new InventoryBoxStock({ inventoryLotId: lot.id, boxId: await newBox(), quantity: 3 }));
    await boxStockRepo.create(new InventoryBoxStock({ inventoryLotId: lot.id, boxId: await newBox(), quantity: 4 }));

    assert.equal(await boxStockRepo.sumAllocatedByLot(lot.id), 7);
    assert.equal(await boxStockRepo.sumAllocatedByLot(emptyLot.id), 0);
  });
});
