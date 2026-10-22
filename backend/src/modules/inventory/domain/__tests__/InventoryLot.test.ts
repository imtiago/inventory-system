import { test } from "node:test";
import assert from "node:assert/strict";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";

const make = (initialQuantity: number, remainingQuantity?: number) =>
  new InventoryLot({
    inventoryId: "inv-1",
    productVariantId: "var-1",
    sourceType: InventoryLotSource.MANUAL,
    initialQuantity,
    remainingQuantity,
    unitCost: 2,
  });

test("receive soma initial e remaining", () => {
  const lot = make(10);
  lot.receive(5);
  assert.equal(lot.initialQuantity, 15);
  assert.equal(lot.remainingQuantity, 15);
});

test("consume reduz remaining e recusa acima", () => {
  const lot = make(10);
  lot.consume(4);
  assert.equal(lot.remainingQuantity, 6);
  assert.throws(() => lot.consume(7));
});

test("restore não ultrapassa initial", () => {
  const lot = make(10);
  lot.consume(4);
  assert.throws(() => lot.restore(5));
  lot.restore(4);
  assert.equal(lot.remainingQuantity, 10);
});

test("remainingQuantity padrão = initialQuantity", () => {
  const lot = make(10);
  assert.equal(lot.remainingQuantity, 10);
  assert.equal(lot.isEmpty(), false);
});
