import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { RegisterScannedProductUseCase } from "@inventory/application/useCases/RegisterScannedProductUseCase";
import { PrismaInventoryBoxRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxRepository";
import { PrismaInventoryBoxStockRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxStockRepository";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { prisma } from "@shared/prisma";

export function makeRegisterScannedProductFactory() {
  const catalogService = makeCatalogService();
  const inventoryRepository = new PrismaInventoryRepository(prisma);
  const inventoryLotRepository = new PrismaInventoryLotRepository(prisma);
  const inventoryBoxRepository = new PrismaInventoryBoxRepository();
  const inventoryBoxStockRepository = new PrismaInventoryBoxStockRepository();
  const transactionManager = new PrismaTransactionManager();

  return new RegisterScannedProductUseCase(
    catalogService,
    inventoryRepository,
    inventoryLotRepository,
    inventoryBoxRepository,
    inventoryBoxStockRepository,
    transactionManager,
  );
}
