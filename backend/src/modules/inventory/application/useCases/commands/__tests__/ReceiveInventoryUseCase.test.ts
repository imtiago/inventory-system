import { test } from "node:test";
import assert from "node:assert/strict";
import { ReceiveInventoryUseCase } from "../ReceiveInventoryUseCase";
import { InventoryApplicationService } from "../../../services/InventoryApplicationService";
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

test("mesmo batchNumber soma no lote: custo vira a média ponderada (2 casas) e validade igual é aceita", async () => {
  const { useCase, lots, movements } = setup();
  const exp = new Date("2030-01-01");
  const first = await useCase.execute(
    input({ batchNumber: "L1", unitCost: 5, expirationDate: exp }),
  );
  const second = await useCase.execute(
    input({ batchNumber: "L1", quantity: 4, unitCost: 50, expirationDate: new Date("2030-01-01") }),
  );
  assert.equal(lots.all().length, 1);
  assert.equal(second.lot.id, first.lot.id);
  assert.equal(second.lot.initialQuantity, 14);
  assert.equal(second.lot.remainingQuantity, 14);
  // (10*5 + 4*50) / 14 = 17.857... -> 17.86
  assert.equal(second.lot.unitCost, 17.86);
  assert.equal(second.lot.expirationDate?.getTime(), exp.getTime());
  assert.equal(second.inventory.quantity, 14);
  const ms = movements
    .all()
    .sort((a, b) => a.currentQuantity! - b.currentQuantity!);
  assert.equal(ms.length, 2);
  assert.equal(ms[1].previousQuantity, 10);
  assert.equal(ms[1].currentQuantity, 14);
});

test("mesmo batchNumber com validade diferente → 409 LOT_DATES_MISMATCH sem alterar nada", async () => {
  const { useCase, lots, movements, inventories } = setup();
  await useCase.execute(input({ batchNumber: "L1", unitCost: 5, expirationDate: new Date("2030-01-10") }));
  await assert.rejects(
    useCase.execute(input({ batchNumber: "L1", quantity: 4, expirationDate: new Date("2031-01-01") })),
    {
      name: "ConflictError",
      code: "LOT_DATES_MISMATCH",
      message: "O lote L1 já existe com validade 10/01/2030. Use outro número de lote ou a mesma validade.",
    },
  );
  assert.equal(lots.all()[0].remainingQuantity, 10);
  assert.equal(movements.all().length, 1);
  assert.equal(inventories.all()[0].quantity, 10);
});

test("mesmo batchNumber: data não informada não conta como divergência; fabricação diferente recusa", async () => {
  const { useCase, lots } = setup();
  await useCase.execute(
    input({
      batchNumber: "L1",
      expirationDate: new Date("2030-01-10"),
      manufacturingDate: new Date("2029-01-10"),
    }),
  );
  await useCase.execute(input({ batchNumber: "L1", quantity: 2 }));
  assert.equal(lots.all()[0].remainingQuantity, 12);
  await assert.rejects(
    useCase.execute(input({ batchNumber: "L1", manufacturingDate: new Date("2029-02-10") })),
    { code: "LOT_DATES_MISMATCH" },
  );
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

test("com purchaseItemId: lote novo ligado ao item; mesmo lote do mesmo item soma", async () => {
  const { useCase, lots, inventories } = setup();
  const first = await useCase.execute(
    input({ batchNumber: "L1", purchaseItemId: "pi-1", originReferenceId: "p-1" }),
  );
  assert.equal(first.lot.purchaseItemId, "pi-1");
  assert.equal(first.lot.sourceId, "p-1");
  const second = await useCase.execute(
    input({ batchNumber: "L1", quantity: 3, purchaseItemId: "pi-1", originReferenceId: "p-1" }),
  );
  assert.equal(second.lot.id, first.lot.id);
  assert.equal(second.lot.initialQuantity, 13);
  assert.equal(lots.all().length, 1);
  assert.equal(inventories.all()[0].quantity, 13);
});

test("com purchaseItemId: lote existente de outra origem/item → 409 BATCH_ALREADY_EXISTS sem alterar saldo", async () => {
  const { useCase, lots, inventories, movements } = setup();
  await useCase.execute(input({ batchNumber: "L1" })); // lote manual, sem item de compra
  await useCase.execute(input({ batchNumber: "L2", purchaseItemId: "pi-1" }));
  for (const batchNumber of ["L1", "L2"]) {
    await assert.rejects(
      () => useCase.execute(input({ batchNumber, purchaseItemId: "pi-2" })),
      {
        name: "ConflictError",
        code: "BATCH_ALREADY_EXISTS",
        message: "Já existe um lote com esse número para esta variante.",
      },
    );
  }
  assert.equal(lots.all().length, 2);
  assert.equal(movements.all().length, 2);
  assert.equal(inventories.all()[0].quantity, 20);
});

test("sem purchaseItemId (entrada manual): lote existente ligado a item de compra → 409 BATCH_ALREADY_EXISTS sem alterar saldo", async () => {
  const { useCase, lots, inventories, movements } = setup();
  await useCase.execute(input({ batchNumber: "L1", purchaseItemId: "pi-1", originReferenceId: "p-1" }));
  await assert.rejects(
    () => useCase.execute(input({ batchNumber: "L1", quantity: 5 })),
    {
      name: "ConflictError",
      code: "BATCH_ALREADY_EXISTS",
      message: "Já existe um lote com esse número para esta variante.",
    },
  );
  assert.equal(lots.all().length, 1);
  assert.equal(lots.all()[0].initialQuantity, 10);
  assert.equal(movements.all().length, 1);
  assert.equal(inventories.all()[0].quantity, 10);
});

test("sem purchaseItemId: lote manual existente continua somando", async () => {
  const { useCase, lots } = setup();
  await useCase.execute(input({ batchNumber: "L1" }));
  const { lot } = await useCase.execute(input({ batchNumber: "L1", quantity: 5 }));
  assert.equal(lots.all().length, 1);
  assert.equal(lot.initialQuantity, 15);
});

test("receivePurchaseStock chama o recebimento com origem/lote PURCHASE, item, usuário e custo em reais", async () => {
  const calls: unknown[] = [];
  const noop = { execute: async () => [] };
  const fake = { execute: async (i: unknown) => (calls.push(i), {}) };
  const service = new InventoryApplicationService(noop as never, noop as never, fake as never, noop as never);
  const exp = new Date("2027-01-15T00:00:00.000Z");
  await service.receivePurchaseStock({
    purchaseId: "p-1",
    purchaseItemId: "pi-1",
    productVariantId: "variant-1",
    quantity: 3,
    unitCostCents: 333,
    batchNumber: "L1",
    expirationDate: exp,
    userId: "u-1",
  });
  assert.deepEqual(calls, [
    {
      productVariantId: "variant-1",
      quantity: 3,
      unitCost: 3.33,
      batchNumber: "L1",
      manufacturingDate: undefined,
      expirationDate: exp,
      origin: StockMovementOrigin.PURCHASE,
      sourceType: InventoryLotSource.PURCHASE,
      originReferenceId: "p-1",
      purchaseItemId: "pi-1",
      userId: "u-1",
    },
  ]);
});
