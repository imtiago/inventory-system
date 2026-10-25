import { test } from "node:test";
import assert from "node:assert/strict";
import { AddProductToBoxUseCase } from "../AddProductToBoxUseCase";
import { RemoveProductFromBoxUseCase } from "../RemoveProductFromBoxUseCase";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";
import { InMemoryInventoryBoxRepository } from "../../../__tests__/fakes";
import { setupStock, snapshot } from "./helpers";

/** Saldos de inventário/lotes e movimentações (sem as alocações por caixa). */
const balances = (s: ReturnType<typeof setupStock>) =>
  JSON.stringify([s.inventories.all(), s.lots.all(), s.movements.all()]);

async function build() {
  const s = setupStock();
  const boxes = new InMemoryInventoryBoxRepository();
  const stocks = s.stocks;
  const add = new AddProductToBoxUseCase(boxes, stocks, s.lots, s.inventories, s.tx);
  const remove = new RemoveProductFromBoxUseCase(boxes, stocks, s.lots, s.inventories, s.tx);
  const boxA = await boxes.create(new InventoryBox({ code: "A" }));
  const boxB = await boxes.create(new InventoryBox({ code: "B" }));
  return { ...s, boxes, stocks, add, remove, boxA, boxB };
}

test("add recusa acima do saldo considerando todas as caixas", async () => {
  const s = await build();
  const { lot } = await s.addLot(10);
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 6 });
  await assert.rejects(
    s.add.execute({ inventoryLotId: lot.id, boxId: s.boxB.id, quantity: 5 }),
    { message: "Quantidade excede o saldo do lote disponível para caixas (4)." },
  );
  assert.equal(await s.stocks.findStock(lot.id, s.boxB.id), null);
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxB.id, quantity: 4 });
  assert.equal(await s.stocks.sumAllocatedByLot(lot.id), 10);
});

test("add não altera saldo do inventário nem do lote", async () => {
  const s = await build();
  const { lot } = await s.addLot(10);
  const before = balances(s);
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 3 });
  assert.equal(balances(s), before);
});

test("add falha com caixa ou lote inexistente", async () => {
  const s = await build();
  const { lot } = await s.addLot(10);
  await assert.rejects(s.add.execute({ inventoryLotId: lot.id, boxId: "x", quantity: 1 }), { name: "NotFoundError", code: "BOX_NOT_FOUND" });
  await assert.rejects(s.add.execute({ inventoryLotId: "x", boxId: s.boxA.id, quantity: 1 }), { name: "NotFoundError", code: "LOT_NOT_FOUND" });
});

test("remove subtrai", async () => {
  const s = await build();
  const { lot } = await s.addLot(10);
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 6 });
  const r = await s.remove.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 2 });
  assert.equal(r.quantity, 4);
  assert.equal((await s.stocks.findStock(lot.id, s.boxA.id))!.quantity, 4);
  await assert.rejects(s.remove.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 5 }), BOX_STOCK_INSUFFICIENT);
  assert.equal((await s.stocks.findStock(lot.id, s.boxA.id))!.quantity, 4);
});

const BOX_STOCK_INSUFFICIENT = {
  name: "BusinessRuleError",
  code: "BOX_STOCK_INSUFFICIENT",
  message: "Quantidade maior que a alocada nesta caixa.",
};

test("remove tudo apaga a alocação da caixa", async () => {
  const s = await build();
  const { lot } = await s.addLot(10);
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 6 });
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxB.id, quantity: 2 });
  const r = await s.remove.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 6 });
  assert.equal(r.quantity, 0);
  assert.equal(await s.stocks.findStock(lot.id, s.boxA.id), null);
  assert.equal((await s.stocks.findStock(lot.id, s.boxB.id))!.quantity, 2);
});

test("remove não altera saldo do inventário nem do lote", async () => {
  const s = await build();
  const { lot } = await s.addLot(10);
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 6 });
  const before = balances(s);
  await s.remove.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 2 });
  assert.equal(balances(s), before);
});

test("remove: caixa ou lote inexistente → 404; lote sem alocação nesta caixa → 422", async () => {
  const s = await build();
  const { lot } = await s.addLot(10);
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 3 });
  const before = await snapshot(s);
  await assert.rejects(s.remove.execute({ inventoryLotId: lot.id, boxId: "x", quantity: 1 }), { name: "NotFoundError", code: "BOX_NOT_FOUND" });
  await assert.rejects(s.remove.execute({ inventoryLotId: "x", boxId: s.boxA.id, quantity: 1 }), { name: "NotFoundError", code: "LOT_NOT_FOUND" });
  await assert.rejects(s.remove.execute({ inventoryLotId: lot.id, boxId: s.boxB.id, quantity: 1 }), BOX_STOCK_INSUFFICIENT);
  assert.equal(await snapshot(s), before);
});

test("add com alocado > restante (após dispatch) reporta disponível 0, nunca negativo", async () => {
  const s = await build();
  const { lot } = await s.addLot(10);
  await s.add.execute({ inventoryLotId: lot.id, boxId: s.boxA.id, quantity: 10 });
  lot.consume(4); // saída reduz o restante sem mexer nas caixas: alocado 10 > restante 6
  await s.lots.update(lot);
  await assert.rejects(
    s.add.execute({ inventoryLotId: lot.id, boxId: s.boxB.id, quantity: 1 }),
    { message: "Quantidade excede o saldo do lote disponível para caixas (0)." },
  );
});
