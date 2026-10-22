import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ManagerCreateInventoryLotUseCase } from "@inventory/application/useCases/workflows/ManagerCreateInventoryLotUseCase";
import { InMemoryTransactionManager } from "@shared/application/transaction/InMemoryTransactionManager";

describe("ManagerCreateInventoryLotUseCase", () => {
  test("lança quando inventory não existe e não cria lote", async () => {
    let createCalls = 0;
    let adjustCalls = 0;

    const getInventoryById = { execute: async () => null };
    const createInventoryLot = {
      execute: async () => {
        createCalls++;
        return {};
      },
    };
    const adjustInventory = {
      execute: async () => {
        adjustCalls++;
        return {};
      },
    };

    const uc = new ManagerCreateInventoryLotUseCase(
      getInventoryById as any,
      createInventoryLot as any,
      adjustInventory as any,
      new InMemoryTransactionManager(),
    );

    await assert.rejects(
      uc.execute({
        inventoryId: "missing",
        productVariantId: "pv-1",
        batchNumber: "L1",
        quantity: 5,
        unitCost: 10,
        expirationDate: new Date(),
      }),
      /Inventory not found/,
    );

    assert.equal(createCalls, 0);
    assert.equal(adjustCalls, 0);
  });
});
