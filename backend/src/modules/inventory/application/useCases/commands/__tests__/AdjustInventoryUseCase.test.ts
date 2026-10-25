import { test } from "node:test";
import assert from "node:assert/strict";
import { AdjustInventoryUseCase } from "../AdjustInventoryUseCase";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { InternalInvariantError } from "@shared/domain/errors";
import { setupStock, snapshot } from "./helpers";

function build() {
  const s = setupStock();
  return { ...s, adjust: new AdjustInventoryUseCase(s.inventories, s.lots, s.movements, s.stocks, s.tx) };
}

test("adjust sem diferença retorna null e não grava", async () => {
  const s = build();
  await s.addLot(10);
  const before = await snapshot(s);
  const r = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 10 });
  assert.equal(r, null);
  assert.equal(await snapshot(s), before);
});

test("adjust para baixo consome FIFO e registra ADJUSTMENT q=|diff|", async () => {
  const s = build();
  const a = await s.addLot(3);
  const b = await s.addLot(5);
  const m = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 4, userId: "u1", notes: "contagem" });
  assert.equal((await s.lots.findById(a.lot.id))!.remainingQuantity, 0);
  assert.equal((await s.lots.findById(b.lot.id))!.remainingQuantity, 4);
  assert.equal((await s.inventories.findById(a.inventory.id))!.quantity, 4);
  assert.ok(m);
  assert.equal(m.type, StockMovementType.ADJUSTMENT);
  assert.equal(m.origin, StockMovementOrigin.INVENTORY);
  assert.equal(m.quantity, 4);
  assert.equal(m.previousQuantity, 8);
  assert.equal(m.currentQuantity, 4);
  assert.equal(m.inventoryLotId, null);
  assert.equal(m.averageCost, 5);
  assert.equal(m.userId, "u1");
  assert.equal(m.notes, "contagem");
});

test("adjust para cima cria lote MANUAL com custo médio atual", async () => {
  const s = build();
  await s.addLot(10, 5);
  await s.addLot(10, 15); // média 10
  const m = await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 25 });
  const manual = s.lots.all().find((l) => l.sourceType === InventoryLotSource.MANUAL)!;
  assert.ok(manual);
  assert.equal(manual.initialQuantity, 5);
  assert.equal(manual.remainingQuantity, 5);
  assert.equal(manual.unitCost, 10);
  const inv = (await s.inventories.findByProductVariantId("variant-1"))!;
  assert.equal(inv.quantity, 25);
  assert.equal(inv.averageCost, 10);
  assert.equal(m!.type, StockMovementType.ADJUSTMENT);
  assert.equal(m!.quantity, 5);
  assert.equal(m!.previousQuantity, 20);
  assert.equal(m!.currentQuantity, 25);
  assert.equal(m!.inventoryLotId, manual.id);
});

test("adjust com contagem negativa ou sem inventário falha sem gravar", async () => {
  const s = build();
  await assert.rejects(() => s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 1 }), {
    name: "NotFoundError", code: "INVENTORY_NOT_FOUND",
  });
  await s.addLot(5);
  const before = await snapshot(s);
  await assert.rejects(() => s.adjust.execute({ productVariantId: "variant-1", countedQuantity: -1 }), { code: "INVALID_QUANTITY" });
  assert.equal(await snapshot(s), before);
});

test("adjust com lotes inconsistentes lança InternalInvariantError", async () => {
  const s = build();
  const { lot } = await s.addLot(5);
  lot.consume(5); // saldo do estoque diverge dos lotes
  await s.lots.update(lot);
  await assert.rejects(
    () => s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 1 }),
    InternalInvariantError,
  );
});
