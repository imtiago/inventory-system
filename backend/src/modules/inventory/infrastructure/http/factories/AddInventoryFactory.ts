import { AddInventory } from "@inventory/application/useCases/AddInventory";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeAddInventory() {
  const inventoryRepository = new PrismaInventoryRepository();
  const movementRepository = new PrismaStockMovementRepository();

  const transactionManager = new PrismaTransactionManager();

  return new AddInventory(
    inventoryRepository,
    movementRepository,
    transactionManager,
  );
}
