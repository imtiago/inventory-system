import { RemoveProductFromBoxUseCase } from "@inventory/application/useCases/commands/RemoveProductFromBoxUseCase";
import { PrismaInventoryBoxRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxRepository";
import { PrismaInventoryBoxStockRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxStockRepository";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeRemoveProductFromBoxUseCase() {
  return new RemoveProductFromBoxUseCase(
    new PrismaInventoryBoxRepository(),
    new PrismaInventoryBoxStockRepository(),
    new PrismaInventoryLotRepository(),
    new PrismaInventoryRepository(),
    new PrismaTransactionManager(),
  );
}
