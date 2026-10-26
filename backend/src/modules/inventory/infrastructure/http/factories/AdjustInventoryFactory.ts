import { PrismaInventoryBoxStockRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxStockRepository";
import { AdjustInventoryUseCase } from "@inventory/application/useCases/commands/AdjustInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeAdjustInventoryFactory() {
  const inventoryRepository = new PrismaInventoryRepository();
  const inventoryLotRepository = new PrismaInventoryLotRepository();
  const movementRepository = new PrismaStockMovementRepository();
  const transactionManager = new PrismaTransactionManager();

  return new AdjustInventoryUseCase(
    inventoryRepository,
    inventoryLotRepository,
    movementRepository,
    new PrismaInventoryBoxStockRepository(),
    transactionManager,
    async (purchaseId) => (await getDb().purchase.findUnique({ where: { id: purchaseId }, select: { code: true } }))?.code ?? null,
  );
}
