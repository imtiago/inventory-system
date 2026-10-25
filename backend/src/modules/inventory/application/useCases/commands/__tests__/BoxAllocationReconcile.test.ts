import { test } from "node:test";
import assert from "node:assert/strict";
import { DispatchInventoryUseCase } from "../DispatchInventoryUseCase";
import { AdjustInventoryUseCase } from "../AdjustInventoryUseCase";
import { ReturnSaleStockUseCase } from "../ReturnSaleStockUseCase";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { setupStock } from "./helpers";

/**
 * Invariante (spec §5): Σ alocações do lote ≤ saldo do lote. Toda redução do
 * saldo abate as alocações mais antigas primeiro e apaga as que zeram.
 */
function build() {
  const s = setupStock();
  const dispatch = new DispatchInventoryUseCase(s.inventories, s.lots, s.movements, s.stocks, s.tx);
  const adjust = new AdjustInventoryUseCase(s.inventories, s.lots, s.movements, s.stocks, s.tx);
  const returnStock = new ReturnSaleStockUseCase(s.inventories, s.lots, s.movements, s.tx);
  const allocate = (inventoryLotId: string, boxId: string, quantity: number, minute: number) =>
    s.stocks.create(
      new InventoryBoxStock({
        inventoryLotId,
        boxId,
        quantity,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
      }),
    );
  const allocations = (lotId: string) =>
    s.stocks
      .all()
      .filter((a) => a.inventoryLotId === lotId)
      .map((a) => [a.boxId, a.quantity])
      .sort();
  const sum = (lotId: string) =>
    s.stocks
      .all()
      .filter((a) => a.inventoryLotId === lotId)
      .reduce((t, a) => t + a.quantity, 0);
  return { ...s, dispatch, adjust, returnStock, allocate, allocations, sum };
}

const out = (quantity: number, origin = StockMovementOrigin.MANUAL, originReferenceId?: string) => ({
  productVariantId: "variant-1",
  quantity,
  origin,
  originReferenceId,
});

test("saída reduz as alocações mais antigas primeiro e apaga as que zeram", async () => {
  const s = build();
  const { lot } = await s.addLot(10);
  await s.allocate(lot.id, "box-new", 5, 9);
  await s.allocate(lot.id, "box-old", 4, 1);

  await s.dispatch.execute(out(6)); // saldo 4; Σ 9 → excesso 5

  assert.deepEqual(s.allocations(lot.id), [["box-new", 4]]);
  assert.ok(s.sum(lot.id) <= (await s.lots.findById(lot.id))!.remainingQuantity);
});

test("saída que não estoura a invariante não mexe nas alocações", async () => {
  const s = build();
  const { lot } = await s.addLot(10);
  await s.allocate(lot.id, "box-a", 3, 1);
  await s.allocate(lot.id, "box-b", 2, 2);

  await s.dispatch.execute(out(5)); // saldo 5 = Σ 5

  assert.deepEqual(s.allocations(lot.id), [
    ["box-a", 3],
    ["box-b", 2],
  ]);
});

test("saída em vários lotes reconcilia cada lote consumido", async () => {
  const s = build();
  const a = await s.addLot(3);
  const b = await s.addLot(5);
  await s.allocate(a.lot.id, "box-a", 3, 1);
  await s.allocate(b.lot.id, "box-b", 2, 1);

  await s.dispatch.execute(out(4)); // a: 0; b: 4 ≥ 2

  assert.deepEqual(s.allocations(a.lot.id), []);
  assert.deepEqual(s.allocations(b.lot.id), [["box-b", 2]]);
});

test("ajuste para baixo reduz as alocações mais antigas primeiro", async () => {
  const s = build();
  const { lot } = await s.addLot(10);
  await s.allocate(lot.id, "box-old", 6, 1);
  await s.allocate(lot.id, "box-new", 4, 2);

  await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 7 }); // excesso 3

  assert.deepEqual(s.allocations(lot.id), [
    ["box-new", 4],
    ["box-old", 3],
  ]);
});

test("ajuste para cima não mexe nas alocações", async () => {
  const s = build();
  const { lot } = await s.addLot(10);
  await s.allocate(lot.id, "box-a", 10, 1);

  await s.adjust.execute({ productVariantId: "variant-1", countedQuantity: 12 });

  assert.deepEqual(s.allocations(lot.id), [["box-a", 10]]);
});

test("venda reduz alocações; cancelamento devolve o saldo sem realocar em caixa", async () => {
  const s = build();
  const { lot } = await s.addLot(10);
  await s.allocate(lot.id, "box-a", 8, 1);

  await s.dispatch.execute(out(5, StockMovementOrigin.SALE, "sale-1")); // saldo 5
  assert.deepEqual(s.allocations(lot.id), [["box-a", 5]]);

  await s.returnStock.execute({ saleId: "sale-1", items: [{ productVariantId: "variant-1", quantity: 5 }] });
  assert.equal((await s.lots.findById(lot.id))!.remainingQuantity, 10);
  assert.deepEqual(s.allocations(lot.id), [["box-a", 5]]);
});
