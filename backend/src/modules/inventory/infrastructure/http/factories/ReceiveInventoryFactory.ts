import { ReceiveInventoryUseCase } from "@inventory/application/useCases/ReceiveInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/repositories/PrismaInventoryLotRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeReceiveInventory() {
  const inventoryRepository = new PrismaInventoryRepository();
  const inventoryLotRepository = new PrismaInventoryLotRepository();
  const movementRepository = new PrismaStockMovementRepository();
  const transactionManager = new PrismaTransactionManager();

  return new ReceiveInventoryUseCase(
    inventoryRepository,
    inventoryLotRepository,
    movementRepository,
    transactionManager,
  );
}
