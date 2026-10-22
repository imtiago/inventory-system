import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { ReceiveInventoryUseCase } from "@inventory/application/useCases/commands/ReceiveInventoryUseCase";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeReceiveInventory() {
  return new ReceiveInventoryUseCase(
    makeCatalogService(),
    new PrismaInventoryRepository(),
    new PrismaInventoryLotRepository(),
    new PrismaStockMovementRepository(),
    new PrismaTransactionManager(),
  );
}
