import { test } from "node:test";
import assert from "node:assert/strict";
import { DispatchInventoryUseCase } from "../DispatchInventoryUseCase";
import { ReturnSaleStockUseCase } from "../ReturnSaleStockUseCase";
import { InventoryApplicationService } from "../../../services/InventoryApplicationService";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
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
  const items = (quantity: number) => [{ productVariantId: "variant-1", quantity }];
  return { ...s, dispatch, returnStock, sell, items };
}

test("returnSaleStock devolve a cada lote o que saiu dele, com IN RETURN encadeados", async () => {
  const s = build();
  const a = await s.addLot(3, 5);
  const b = await s.addLot(5, 7);
  await s.sell(6, "sale-1");

  const result = await s.returnStock.execute({ saleId: "sale-1", userId: "canceler-1", items: s.items(6) });

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

test("returnSaleStock restaura o custo médio: 10@10 + 10@20 (média 15), vende 10, cancela → média 15", async () => {
  const s = build();
  await s.addLot(10, 10);
  const { inventory } = await s.addLot(10, 20);
  const [out] = await s.sell(10, "sale-1"); // FIFO: consome o lote de custo 10
  assert.equal(out.averageCost, 15);

  const [ret] = await s.returnStock.execute({ saleId: "sale-1", items: s.items(10) });

  const after = (await s.inventories.findById(inventory.id))!;
  assert.equal(after.quantity, 20);
  assert.equal(after.averageCost, 15);
  assert.equal(ret.averageCost, 15);
});

test("returnSaleStock usa o averageCost da saída (≠ custo do lote) e, se nulo, o custo do lote", async () => {
  const s = build();
  const { inventory } = await s.addLot(10, 10);
  const [out] = await s.sell(4, "sale-1");
  // Custo médio registrado na saída diferente do custo do lote.
  await s.movements.update(rewriteAverageCost(out, 13));
  await s.returnStock.execute({ saleId: "sale-1", items: s.items(4) });
  // 6 a 10 + 4 a 13 → (60 + 52) / 10 = 11,2
  assert.equal((await s.inventories.findById(inventory.id))!.averageCost, 11.2);

  const t = build();
  const second = await t.addLot(10, 10);
  const [out2] = await t.sell(4, "sale-2");
  await t.addLot(10, 30); // média passa a (60 + 300) / 16 = 22,5
  await t.movements.update(rewriteAverageCost(out2, null));
  await t.returnStock.execute({ saleId: "sale-2", items: t.items(4) });
  // Sem averageCost na saída → custo do lote (10): (16 × 22,5 + 4 × 10) / 20 = 20
  assert.equal((await t.inventories.findById(second.inventory.id))!.averageCost, 20);
});

function rewriteAverageCost(m: StockMovement, averageCost: number | null) {
  return new StockMovement({
    id: m.id,
    inventoryId: m.inventoryId,
    inventoryLotId: m.inventoryLotId,
    productVariantId: m.productVariantId,
    type: m.type,
    origin: m.origin,
    quantity: m.quantity,
    previousQuantity: m.previousQuantity,
    currentQuantity: m.currentQuantity,
    originId: m.originId,
    userId: m.userId,
    averageCost,
    createdAt: m.createdAt,
  });
}

test("returnSaleStock só devolve as saídas da venda indicada", async () => {
  const s = build();
  const a = await s.addLot(10, 5);
  await s.sell(2, "sale-1");
  await s.sell(3, "sale-2");

  await s.returnStock.execute({ saleId: "sale-1", items: s.items(2) });

  // 10 − 2 − 3 + 2: a saída da sale-2 continua consumida.
  assert.equal((await s.lots.findById(a.lot.id))!.remainingQuantity, 7);
  assert.equal((await s.inventories.findById(a.inventory.id))!.quantity, 7);
  const returns = s.movements.all().filter((m) => m.origin === StockMovementOrigin.RETURN);
  assert.deepEqual(returns.map((m) => [m.originId, m.quantity]), [["sale-1", 2]]);
});

test("venda com itens mas sem saídas rastreadas → InternalInvariantError sem gravar", async () => {
  const s = build();
  await s.addLot(3, 5);
  const before = await snapshot(s);
  await assert.rejects(
    () => s.returnStock.execute({ saleId: "sale-x", items: s.items(1) }),
    (e: unknown) => e instanceof InternalInvariantError && e.code === "SALE_STOCK_MISMATCH",
  );
  assert.equal(await snapshot(s), before);
});

test("quantidade devolvida por variante ≠ itens da venda → InternalInvariantError sem gravar", async () => {
  const s = build();
  await s.addLot(10, 5);
  await s.sell(3, "sale-1");
  const before = await snapshot(s);
  for (const items of [
    s.items(2),
    [...s.items(3), { productVariantId: "variant-2", quantity: 1 }],
  ]) {
    await assert.rejects(
      () => s.returnStock.execute({ saleId: "sale-1", items }),
      (e: unknown) => e instanceof InternalInvariantError && e.code === "SALE_STOCK_MISMATCH",
    );
  }
  assert.equal(await snapshot(s), before);
});

test("venda sem itens e sem saídas não altera nada", async () => {
  const s = build();
  await s.addLot(3, 5);
  const before = await snapshot(s);
  assert.deepEqual(await s.returnStock.execute({ saleId: "sale-x", items: [] }), []);
  assert.equal(await snapshot(s), before);
});

test("devolução que estouraria o lote → InternalInvariantError sem gravar", async () => {
  const s = build();
  const { lot } = await s.addLot(5, 5);
  await s.sell(2, "sale-1");
  // Lote já cheio de novo (dado inconsistente).
  const current = (await s.lots.findById(lot.id))!;
  current.restore(2);
  await s.lots.update(current);
  const before = await snapshot(s);
  await assert.rejects(
    () => s.returnStock.execute({ saleId: "sale-1", items: s.items(2) }),
    (e: unknown) => e instanceof InternalInvariantError && e.code === "INVENTORY_LOTS_INCONSISTENT",
  );
  assert.equal(await snapshot(s), before);
});

test("returnSaleStock repetido para a mesma venda lança InternalInvariantError sem gravar", async () => {
  const s = build();
  await s.addLot(3, 5);
  await s.sell(2, "sale-1");
  await s.returnStock.execute({ saleId: "sale-1", items: s.items(2) });
  const before = await snapshot(s);
  await assert.rejects(() => s.returnStock.execute({ saleId: "sale-1", items: s.items(2) }), InternalInvariantError);
  assert.equal(await snapshot(s), before);
});

test("InventoryApplicationService.returnSaleStock delega com saleId, userId e itens", async () => {
  const calls: unknown[] = [];
  const noop = { execute: async () => [] };
  const fake = { execute: async (i: unknown) => (calls.push(i), []) };
  const service = new InventoryApplicationService(noop as never, fake as never);
  const items = [{ productVariantId: "v-1", quantity: 2 }];
  await service.returnSaleStock({ saleId: "sale-1", userId: "u-1", items });
  assert.deepEqual(calls, [{ saleId: "sale-1", userId: "u-1", items }]);
});
