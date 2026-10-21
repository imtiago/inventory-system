import { ReleaseInventoryUseCase } from "@inventory/application/useCases/commands/ReleaseInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { prisma } from "@shared/prisma";

export function makeReleaseInventoryFactory() {
  const inventoryRepository = new PrismaInventoryRepository(prisma);
  const movementRepository = new PrismaStockMovementRepository(prisma);
  const transactionManager = new PrismaTransactionManager();

  return new ReleaseInventoryUseCase(
    inventoryRepository,
    movementRepository,
    transactionManager,
  );
}
