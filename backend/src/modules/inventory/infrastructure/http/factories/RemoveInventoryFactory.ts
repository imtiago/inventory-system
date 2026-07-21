import { RemoveInventory } from "@inventory/application/useCases/RemoveInventory";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeRemoveInventory() {
  const inventoryRepository = new PrismaInventoryRepository();
  const movementRepository = new PrismaStockMovementRepository();

  const transactionManager = new PrismaTransactionManager();

  return new RemoveInventory(
    inventoryRepository,
    movementRepository,
    transactionManager,
  );
}
