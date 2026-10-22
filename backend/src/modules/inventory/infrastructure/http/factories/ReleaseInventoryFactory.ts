import { ReleaseInventoryUseCase } from "@inventory/application/useCases/commands/ReleaseInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeReleaseInventoryFactory() {
  const inventoryRepository = new PrismaInventoryRepository();
  const movementRepository = new PrismaStockMovementRepository();
  const transactionManager = new PrismaTransactionManager();

  return new ReleaseInventoryUseCase(
    inventoryRepository,
    movementRepository,
    transactionManager,
  );
}
