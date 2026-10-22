import { InventoryApplicationService } from "@inventory/application/services/InventoryApplicationService";
// import { RemoveInventory } from "@inventory/application/useCases/DispatchInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeInventoryService() {
  const inventoryRepository = new PrismaInventoryRepository();
  const movementRepository = new PrismaStockMovementRepository();
  const transactionManager = new PrismaTransactionManager();

  // const consumeStock = new RemoveInventory(
  //   inventoryRepository,
  //   movementRepository,
  //   transactionManager,
  // );

  // return new InventoryApplicationService(consumeStock);
}
