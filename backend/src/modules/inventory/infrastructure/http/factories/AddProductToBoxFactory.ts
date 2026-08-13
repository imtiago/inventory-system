import { AddProductToBoxUseCase } from "@inventory/application/useCases/AddProductToBoxUseCase";
import { PrismaInventoryBoxRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxRepository";
import { PrismaInventoryBoxStockRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxStockRepository";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/repositories/PrismaInventoryLotRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeAddProductToBoxUseCase() {
  const inventoryLotRepository = new PrismaInventoryLotRepository();
  const inventoryBoxStockRepository = new PrismaInventoryBoxStockRepository();
  const inventoryBoxRepository = new PrismaInventoryBoxRepository();
  const transactionManager = new PrismaTransactionManager();

  return new AddProductToBoxUseCase(
    inventoryBoxRepository,
    inventoryBoxStockRepository,
    inventoryLotRepository,
    transactionManager,
  );
}
