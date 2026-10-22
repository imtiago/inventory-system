import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { RegisterScannedProductUseCase } from "@inventory/application/useCases/commands/RegisterScannedProductUseCase";
import { ReceiveInventoryUseCase } from "@inventory/application/useCases/commands/ReceiveInventoryUseCase";
import { AddProductToBoxUseCase } from "@inventory/application/useCases/commands/AddProductToBoxUseCase";
import { PrismaInventoryBoxRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxRepository";
import { PrismaInventoryBoxStockRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxStockRepository";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeRegisterScannedProductFactory() {
  const catalogService = makeCatalogService();
  const inventoryRepository = new PrismaInventoryRepository();
  const inventoryLotRepository = new PrismaInventoryLotRepository();
  const inventoryBoxRepository = new PrismaInventoryBoxRepository();
  const inventoryBoxStockRepository = new PrismaInventoryBoxStockRepository();
  const transactionManager = new PrismaTransactionManager();

  const receiveInventory = new ReceiveInventoryUseCase(
    catalogService,
    inventoryRepository,
    inventoryLotRepository,
    new PrismaStockMovementRepository(),
    transactionManager,
  );
  const addProductToBox = new AddProductToBoxUseCase(
    inventoryBoxRepository,
    inventoryBoxStockRepository,
    inventoryLotRepository,
    inventoryRepository,
    transactionManager,
  );

  return new RegisterScannedProductUseCase(
    catalogService,
    receiveInventory,
    addProductToBox,
    inventoryRepository,
    inventoryBoxRepository,
    transactionManager,
  );
}
