import { AdjustInventoryUseCase } from "@inventory/application/useCases/commands/AdjustInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { prisma } from "@shared/prisma";

export function makeAdjustInventoryFactory() {
  const inventoryRepository = new PrismaInventoryRepository(prisma);
  const movementRepository = new PrismaStockMovementRepository(prisma);
  const transactionManager = new PrismaTransactionManager();

  return new AdjustInventoryUseCase(
    inventoryRepository,
    movementRepository,
    transactionManager,
  );
}
