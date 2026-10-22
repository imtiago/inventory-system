import { test } from "node:test";
import assert from "node:assert/strict";
import { ReceiveInventoryUseCase } from "../ReceiveInventoryUseCase";
import { IReceiveInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { InMemoryTransactionManager } from "@shared/application/transaction/InMemoryTransactionManager";
import {
  FakeCatalogService,
  InMemoryInventoryLotRepository,
  InMemoryInventoryRepository,
  InMemoryStockMovementRepository,
  makeVariant,
} from "../../../__tests__/fakes";

function setup() {
  const inventories = new InMemoryInventoryRepository();
  const lots = new InMemoryInventoryLotRepository();
  const movements = new InMemoryStockMovementRepository();
  const useCase = new ReceiveInventoryUseCase(
    new FakeCatalogService([makeVariant()]),
    inventories,
    lots,
    movements,
    new InMemoryTransactionManager(),
  );
  return { inventories, lots, movements, useCase };
}

function input(
  overrides: Partial<IReceiveInventoryInput> = {},
): IReceiveInventoryInput {
  return {
    productVariantId: "variant-1",
    quantity: 10,
    unitCost: 5,
    origin: StockMovementOrigin.PURCHASE,
    sourceType: InventoryLotSource.PURCHASE,
    ...overrides,
  };
}

test("cria inventário quando não existe", async () => {
  const { useCase, inventories } = setup();
  const { inventory } = await useCase.execute(input());
  assert.equal(inventories.all().length, 1);
  assert.equal(inventory.quantity, 10);
  assert.equal(inventory.productVariantId, "variant-1");
});

test("variante inexistente lança 'Variante não encontrada.'", async () => {
  const { useCase } = setup();
  await assert.rejects(
    () => useCase.execute(input({ productVariantId: "nope" })),
    { message: "Variante não encontrada." },
  );
});

test("lote novo: saldo, lote e movimentação IN com prev 0 / cur 10", async () => {
  const { useCase, lots, movements } = setup();
  const { inventory, lot } = await useCase.execute(
    input({ batchNumber: "L1" }),
  );
  assert.equal(inventory.quantity, 10);
  assert.equal(lot.initialQuantity, 10);
  assert.equal(lot.remainingQuantity, 10);
  assert.equal(lots.all().length, 1);
  const [m] = movements.all();
  assert.equal(m.type, StockMovementType.IN);
  assert.equal(m.previousQuantity, 0);
  assert.equal(m.currentQuantity, 10);
});

test("custo médio ponderado", async () => {
  const { useCase, movements } = setup();
  await useCase.execute(input({ quantity: 10, unitCost: 5 }));
  const { inventory } = await useCase.execute(
    input({ quantity: 10, unitCost: 15 }),
  );
  assert.equal(inventory.averageCost, 10);
  assert.equal(inventory.quantity, 20);
  const second = movements
    .all()
    .sort((a, b) => a.currentQuantity! - b.currentQuantity!)[1];
  assert.equal(second.previousQuantity, 10);
  assert.equal(second.currentQuantity, 20);
  assert.equal(second.averageCost, 10);
});

test("mesmo batchNumber soma no lote existente mantendo unitCost e validade originais", async () => {
  const { useCase, lots, movements } = setup();
  const exp = new Date("2030-01-01");
  const first = await useCase.execute(
    input({ batchNumber: "L1", unitCost: 5, expirationDate: exp }),
  );
  const second = await useCase.execute(
    input({
      batchNumber: "L1",
      quantity: 4,
      unitCost: 50,
      expirationDate: new Date("2031-01-01"),
    }),
  );
  assert.equal(lots.all().length, 1);
  assert.equal(second.lot.id, first.lot.id);
  assert.equal(second.lot.initialQuantity, 14);
  assert.equal(second.lot.remainingQuantity, 14);
  assert.equal(second.lot.unitCost, 5);
  assert.equal(second.lot.expirationDate?.getTime(), exp.getTime());
  assert.equal(second.inventory.quantity, 14);
  const ms = movements
    .all()
    .sort((a, b) => a.currentQuantity! - b.currentQuantity!);
  assert.equal(ms.length, 2);
  assert.equal(ms[1].previousQuantity, 10);
  assert.equal(ms[1].currentQuantity, 14);
});

test("sem batchNumber cria lotes separados", async () => {
  const { useCase, lots } = setup();
  await useCase.execute(input());
  await useCase.execute(input());
  assert.equal(lots.all().length, 2);
});

test("movimentação registra inventoryLotId, averageCost, userId", async () => {
  const { useCase, movements } = setup();
  const { lot } = await useCase.execute(
    input({ userId: "user-1", originReferenceId: "ref-1", notes: "n" }),
  );
  const [m] = movements.all();
  assert.equal(m.inventoryLotId, lot.id);
  assert.equal(m.averageCost, 5);
  assert.equal(m.userId, "user-1");
  assert.equal(m.originId, "ref-1");
  assert.equal(m.notes, "n");
});

test("persistência: lote e inventário gravados refletem o estado após o use case", async () => {
  const { useCase, lots, inventories } = setup();
  const { lot, inventory } = await useCase.execute(input({ batchNumber: "L1" }));
  await useCase.execute(input({ batchNumber: "L1", quantity: 5 }));
  assert.equal((await lots.findById(lot.id))!.remainingQuantity, 15);
  assert.equal((await inventories.findById(inventory.id))!.quantity, 15);
});
