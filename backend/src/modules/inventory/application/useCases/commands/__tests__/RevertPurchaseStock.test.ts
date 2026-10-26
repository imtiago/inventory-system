import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryTransactionManager } from "@shared/application/transaction/InMemoryTransactionManager";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import {
  InMemoryInventoryBoxStockRepository,
  InMemoryInventoryLotRepository,
  InMemoryInventoryRepository,
  InMemoryStockMovementRepository,
} from "../../../__tests__/fakes";
import { RevertPurchaseStockUseCase } from "../RevertPurchaseStockUseCase";

async function setup({ reserved = 0 } = {}) {
  const inventories = new InMemoryInventoryRepository();
  const lots = new InMemoryInventoryLotRepository();
  const movements = new InMemoryStockMovementRepository();
  const boxes = new InMemoryInventoryBoxStockRepository(lots);
  // Antes: 10 un a 5,00. Pedido p-1: 6 un a 8,00 (média 6,125 com 16 un).
  const inventory = await inventories.create(
    new Inventory({ productVariantId: "v-1", quantity: 16, reservedQuantity: reserved, averageCost: 6.125 }),
  );
  await lots.create(
    new InventoryLot({ inventoryId: inventory.id, productVariantId: "v-1", sourceType: InventoryLotSource.MANUAL, initialQuantity: 10, unitCost: 5 }),
  );
  const purchaseLot = await lots.create(
    new InventoryLot({
      inventoryId: inventory.id,
      productVariantId: "v-1",
      sourceType: InventoryLotSource.PURCHASE,
      sourceId: "p-1",
      initialQuantity: 6,
      unitCost: 8,
    }),
  );
  const uc = new RevertPurchaseStockUseCase(inventories, lots, movements, boxes, new InMemoryTransactionManager());
  const input = { purchaseId: "p-1", productVariantIds: ["v-1"], notes: "Estorno da NF-e 1", userId: "u-1" };
  return { uc, input, inventories, lots, movements, purchaseLot };
}

test("estorno: tira o lote do pedido e recalcula o custo médio pelos lotes que ficam", async () => {
  const { uc, input, inventories, lots, movements, purchaseLot } = await setup();
  assert.deepEqual(await uc.execute(input), { status: "REVERTED", lots: 1 });

  const inventory = (await inventories.findByProductVariantId("v-1"))!;
  assert.deepEqual([inventory.quantity, inventory.averageCost], [10, 5]);
  assert.equal((await lots.findById(purchaseLot.id))!.remainingQuantity, 0);
  const [out] = movements.all();
  assert.deepEqual(
    [out.type, out.origin, out.quantity, out.previousQuantity, out.currentQuantity, out.notes, out.originId],
    ["OUT", "PURCHASE", 6, 16, 10, "Estorno da NF-e 1", "p-1"],
  );
});

test("saldo reservado que o estorno invadiria → STOCK_USED sem gravar nada", async () => {
  const { uc, input, inventories, lots, movements, purchaseLot } = await setup({ reserved: 11 });
  assert.deepEqual(await uc.execute(input), { status: "STOCK_USED" });
  assert.equal((await inventories.findByProductVariantId("v-1"))!.quantity, 16);
  assert.equal((await lots.findById(purchaseLot.id))!.remainingQuantity, 6);
  assert.equal(movements.all().length, 0);
});

test("lote do pedido com saída → STOCK_USED sem gravar nada", async () => {
  const { uc, input, lots, movements, purchaseLot } = await setup();
  const lot = (await lots.findById(purchaseLot.id))!;
  lot.consume(1);
  await lots.update(lot);
  assert.deepEqual(await uc.execute(input), { status: "STOCK_USED" });
  assert.equal(movements.all().length, 0);
});
