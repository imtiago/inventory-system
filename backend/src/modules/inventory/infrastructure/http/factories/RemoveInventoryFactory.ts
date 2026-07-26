import { RemoveInventory } from "@inventory/application/useCases/RemoveInventory";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
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
