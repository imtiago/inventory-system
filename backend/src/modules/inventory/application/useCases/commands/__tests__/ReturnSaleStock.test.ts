import { test } from "node:test";
import assert from "node:assert/strict";
import { DispatchInventoryUseCase } from "../DispatchInventoryUseCase";
import { ReturnSaleStockUseCase } from "../ReturnSaleStockUseCase";
import { InventoryApplicationService } from "../../../services/InventoryApplicationService";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { InternalInvariantError } from "@shared/domain/errors";
import { setupStock, snapshot } from "./helpers";

function build() {
  const s = setupStock();
  const dispatch = new DispatchInventoryUseCase(s.inventories, s.lots, s.movements, s.tx);
  const returnStock = new ReturnSaleStockUseCase(s.inventories, s.lots, s.movements, s.tx);
  const sell = (quantity: number, saleId: string) =>
    dispatch.execute({
      productVariantId: "variant-1",
      quantity,
      origin: StockMovementOrigin.SALE,
      originReferenceId: saleId,
      userId: "seller-1",
    });
  return { ...s, dispatch, returnStock, sell };
}

test("returnSaleStock devolve a cada lote o que saiu dele, com IN RETURN encadeados", async () => {
  const s = build();
  const a = await s.addLot(3, 5);
  const b = await s.addLot(5, 7);
  await s.sell(6, "sale-1");

  const result = await s.returnStock.execute({ saleId: "sale-1", userId: "canceler-1" });

  assert.equal((await s.lots.findById(a.lot.id))!.remainingQuantity, 3);
  assert.equal((await s.lots.findById(b.lot.id))!.remainingQuantity, 5);
  assert.equal((await s.inventories.findById(a.inventory.id))!.quantity, 8);

  assert.deepEqual(
    result.map((m) => [m.type, m.origin, m.originId, m.inventoryLotId, m.quantity, m.previousQuantity, m.currentQuantity, m.userId]),
    [
      [StockMovementType.IN, StockMovementOrigin.RETURN, "sale-1", a.lot.id, 3, 2, 5, "canceler-1"],
      [StockMovementType.IN, StockMovementOrigin.RETURN, "sale-1", b.lot.id, 3, 5, 8, "canceler-1"],
    ],
  );
  const persisted = s.movements.all().filter((m) => m.origin === StockMovementOrigin.RETURN);
  assert.equal(persisted.length, 2);
});

test("returnSaleStock recebe no inventário pelo custo unitário do lote (média ponderada)", async () => {
  const s = build();
  await s.addLot(4, 10);
  const { inventory } = await s.addLot(4, 20);
  await s.sell(4, "sale-1"); // consome o lote de custo 10
  await s.returnStock.execute({ saleId: "sale-1" });
  const after = (await s.inventories.findById(inventory.id))!;
  assert.equal(after.quantity, 8);
  // 4 restantes a 15 + 4 devolvidas a 10 → 12,5
  assert.equal(after.averageCost, 12.5);
});

test("returnSaleStock só devolve as saídas da venda indicada", async () => {
  const s = build();
  const a = await s.addLot(10, 5);
  await s.sell(2, "sale-1");
  await s.sell(3, "sale-2");

  await s.returnStock.execute({ saleId: "sale-1" });

  // 10 − 2 − 3 + 2: a saída da sale-2 continua consumida.
  assert.equal((await s.lots.findById(a.lot.id))!.remainingQuantity, 7);
  assert.equal((await s.inventories.findById(a.inventory.id))!.quantity, 7);
  const returns = s.movements.all().filter((m) => m.origin === StockMovementOrigin.RETURN);
  assert.deepEqual(returns.map((m) => [m.originId, m.quantity]), [["sale-1", 2]]);
});

test("returnSaleStock sem saídas da venda não altera nada", async () => {
  const s = build();
  await s.addLot(3, 5);
  const before = await snapshot(s);
  const result = await s.returnStock.execute({ saleId: "sale-x" });
  assert.deepEqual(result, []);
  assert.equal(await snapshot(s), before);
});

test("returnSaleStock repetido para a mesma venda lança InternalInvariantError sem gravar", async () => {
  const s = build();
  await s.addLot(3, 5);
  await s.sell(2, "sale-1");
  await s.returnStock.execute({ saleId: "sale-1" });
  const before = await snapshot(s);
  await assert.rejects(() => s.returnStock.execute({ saleId: "sale-1" }), InternalInvariantError);
  assert.equal(await snapshot(s), before);
});

test("InventoryApplicationService.returnSaleStock delega com saleId e userId", async () => {
  const calls: unknown[] = [];
  const noop = { execute: async () => [] };
  const fake = { execute: async (i: unknown) => (calls.push(i), []) };
  const service = new InventoryApplicationService(noop as never, fake as never);
  await service.returnSaleStock({ saleId: "sale-1", userId: "u-1" });
  assert.deepEqual(calls, [{ saleId: "sale-1", userId: "u-1" }]);
});
