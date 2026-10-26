import { test } from "node:test";
import assert from "node:assert/strict";
import { ReserveInventoryUseCase } from "../ReserveInventoryUseCase";
import { ReleaseInventoryUseCase } from "../ReleaseInventoryUseCase";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { setupStock, snapshot } from "./helpers";

function build() {
  const s = setupStock();
  return {
    ...s,
    reserve: new ReserveInventoryUseCase(s.inventories, s.movements, s.tx),
    release: new ReleaseInventoryUseCase(s.inventories, s.movements, s.tx),
  };
}

test("reserve altera só reservado e registra RESERVE prev=cur", async () => {
  const s = build();
  const { inventory } = await s.addLot(10);
  const m = await s.reserve.execute({ productVariantId: "variant-1", quantity: 4, origin: StockMovementOrigin.SALE, originId: "o1", userId: "u1" });
  const inv = (await s.inventories.findById(inventory.id))!;
  assert.equal(inv.quantity, 10);
  assert.equal(inv.reservedQuantity, 4);
  assert.equal(m.type, StockMovementType.RESERVE);
  assert.equal(m.origin, StockMovementOrigin.SALE);
  assert.equal(m.quantity, 4);
  assert.equal(m.previousQuantity, 10);
  assert.equal(m.currentQuantity, 10);
  assert.equal(m.averageCost, 5);
  assert.equal(m.originId, "o1");
  assert.equal(m.userId, "u1");
  assert.equal(s.movements.all().filter((x) => x.type === StockMovementType.RESERVE).length, 1);
});

test("reserve acima do disponível falha sem gravar", async () => {
  const s = build();
  await s.addLot(10);
  const before = await snapshot(s);
  await assert.rejects(() => s.reserve.execute({ productVariantId: "variant-1", quantity: 11, origin: StockMovementOrigin.SALE, originId: "o1" }));
  assert.equal(await snapshot(s), before);
});

test("release reduz reservado e registra RELEASE prev=cur", async () => {
  const s = build();
  const { inventory } = await s.addLot(10);
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 4, origin: StockMovementOrigin.SALE, originId: "o1" });
  const m = await s.release.execute({ inventoryId: inventory.id, quantity: 3, origin: StockMovementOrigin.SALE, originId: "o1" });
  const inv = (await s.inventories.findById(inventory.id))!;
  assert.equal(inv.reservedQuantity, 1);
  assert.equal(inv.quantity, 10);
  assert.equal(m.type, StockMovementType.RELEASE);
  assert.equal(m.previousQuantity, 10);
  assert.equal(m.currentQuantity, 10);
  assert.equal(m.quantity, 3);
});

test("release acima do reservado falha", async () => {
  const s = build();
  const { inventory } = await s.addLot(10);
  await s.reserve.execute({ productVariantId: "variant-1", quantity: 2, origin: StockMovementOrigin.SALE, originId: "o1" });
  const before = await snapshot(s);
  await assert.rejects(() => s.release.execute({ inventoryId: inventory.id, quantity: 3, origin: StockMovementOrigin.SALE, originId: "o1" }));
  assert.equal(await snapshot(s), before);
});
