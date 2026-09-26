import { DispatchInventoryUseCase } from "@inventory/application/useCases/DispatchInventoryUseCase";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { prisma } from "@shared/prisma";

export function makeDispatchInventory() {
  const inventoryRepository = new PrismaInventoryRepository(prisma);
  const inventoryLotRepository = new PrismaInventoryLotRepository(prisma);
  const movementRepository = new PrismaStockMovementRepository(prisma);
  const transactionManager = new PrismaTransactionManager();

  return new DispatchInventoryUseCase(
    inventoryRepository,
    inventoryLotRepository,
    movementRepository,
    transactionManager,
  );
}
