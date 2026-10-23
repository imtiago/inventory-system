import { ReturnSaleStockUseCase } from "@inventory/application/useCases/commands/ReturnSaleStockUseCase";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeReturnSaleStock() {
  return new ReturnSaleStockUseCase(
    new PrismaInventoryRepository(),
    new PrismaInventoryLotRepository(),
    new PrismaStockMovementRepository(),
    new PrismaTransactionManager(),
  );
}
