import { test } from "node:test";
import assert from "node:assert/strict";
import { DispatchInventoryUseCase } from "../DispatchInventoryUseCase";
import { ReserveInventoryUseCase } from "../ReserveInventoryUseCase";
import { InventoryApplicationService } from "../../../services/InventoryApplicationService";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { setupStock, snapshot } from "./helpers";

function build() {
  const s = setupStock();
  const dispatch = new DispatchInventoryUseCase(
    s.inventories,
    s.lots,
    s.movements,
    s.tx,
  );
  return { ...s, dispatch };
}

const base = { productVariantId: "variant-1", origin: StockMovementOrigin.SALE };

test("dispatch consome FIFO e gera um OUT por lote", async () => {
  const { addLot, dispatch, lots, inventories, movements } = build();
  const a = await addLot(3);
  const b = await addLot(5);
  const result = await dispatch.execute({ ...base, quantity: 6, userId: "u1" });

  assert.equal((await lots.findById(a.lot.id))!.remainingQuantity, 0);
  assert.equal((await lots.findById(b.lot.id))!.remainingQuantity, 2);
  assert.equal((await inventories.findById(a.inventory.id))!.quantity, 2);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((m) => [m.type, m.inventoryLotId, m.quantity, m.previousQuantity, m.currentQuantity]),
    [
      [StockMovementType.OUT, a.lot.id, 3, 8, 5],
      [StockMovementType.OUT, b.lot.id, 3, 5, 2],
    ],
  );
  assert.equal(result[0].averageCost, 5);
  assert.equal(result[0].userId, "u1");
  assert.equal(movements.all().filter((m) => m.type === StockMovementType.OUT).length, 2);
});

test("dispatch acima do disponível falha sem gravar", async () => {
  const s = build();
  await s.addLot(3);
  const before = await snapshot(s);
  await assert.rejects(() => s.dispatch.execute({ ...base, quantity: 4 }), { code: "INSUFFICIENT_STOCK" });
  assert.equal(await snapshot(s), before);
});

test("dispatch sem inventário falha", async () => {
  const s = build();
  await assert.rejects(() => s.dispatch.execute({ ...base, quantity: 1 }), {
    name: "NotFoundError", code: "INVENTORY_NOT_FOUND",
  });
});

test("dispatch respeita reservado", async () => {
  const s = build();
  await s.addLot(10);
  const reserve = new ReserveInventoryUseCase(s.inventories, s.movements, s.tx);
  await reserve.execute({ productVariantId: "variant-1", quantity: 4 });
  const before = await snapshot(s);
  await assert.rejects(() => s.dispatch.execute({ ...base, quantity: 7 }));
  assert.equal(await snapshot(s), before);
  const out = await s.dispatch.execute({ ...base, quantity: 6 });
  assert.equal(out[0].currentQuantity, 4);
});

test("consumeStock chama dispatch com origin SALE", async () => {
  const calls: unknown[] = [];
  const fake = { execute: async (i: unknown) => (calls.push(i), []) };
  const service = new InventoryApplicationService(fake as never);
  await service.consumeStock({ productVariantId: "variant-1", quantity: 2, originId: "sale-1" });
  assert.deepEqual(calls, [
    {
      productVariantId: "variant-1",
      quantity: 2,
      origin: StockMovementOrigin.SALE,
      originReferenceId: "sale-1",
    },
  ]);
});
