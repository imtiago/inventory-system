import { test } from "node:test";
import assert from "node:assert/strict";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";

const make = (
  type: StockMovementType,
  quantity: number,
  previousQuantity: number,
  currentQuantity: number,
  extra: Record<string, unknown> = {},
) =>
  new StockMovement({
    inventoryId: "inv-1",
    productVariantId: "var-1",
    type,
    origin: StockMovementOrigin.MANUAL,
    quantity,
    previousQuantity,
    currentQuantity,
    ...extra,
  });

test("IN exige current = previous + quantity", () => {
  assert.doesNotThrow(() => make(StockMovementType.IN, 5, 10, 15));
  assert.throws(() => make(StockMovementType.IN, 5, 10, 14));
});

test("OUT exige current = previous - quantity", () => {
  assert.doesNotThrow(() => make(StockMovementType.OUT, 5, 10, 5));
  assert.throws(() => make(StockMovementType.OUT, 5, 10, 6));
});

test("RESERVE e RELEASE exigem current = previous", () => {
  assert.doesNotThrow(() => make(StockMovementType.RESERVE, 5, 10, 10));
  assert.doesNotThrow(() => make(StockMovementType.RELEASE, 5, 10, 10));
  assert.throws(() => make(StockMovementType.RESERVE, 5, 10, 15));
  assert.throws(() => make(StockMovementType.RELEASE, 5, 10, 5));
});

test("ADJUSTMENT exige quantity = |current - previous|", () => {
  assert.doesNotThrow(() => make(StockMovementType.ADJUSTMENT, 3, 10, 7));
  assert.throws(() => make(StockMovementType.ADJUSTMENT, 2, 10, 7));
});

test("userId é opcional", () => {
  const m = make(StockMovementType.IN, 5, 10, 15);
  assert.equal(m.userId, null);
  const m2 = make(StockMovementType.IN, 5, 10, 15, { userId: "u1" });
  assert.equal(m2.userId, "u1");
});
