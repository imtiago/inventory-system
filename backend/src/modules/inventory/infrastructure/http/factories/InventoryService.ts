import { InventoryApplicationService } from "@inventory/application/services/InventoryApplicationService";
import { RemoveInventory } from "@inventory/application/useCases/RemoveInventory";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeInventoryService() {
  const inventoryRepository = new PrismaInventoryRepository();
  const movementRepository = new PrismaStockMovementRepository();
  const transactionManager = new PrismaTransactionManager();

  const consumeStock = new RemoveInventory(
    inventoryRepository,
    movementRepository,
    transactionManager,
  );

  return new InventoryApplicationService(consumeStock);
}
