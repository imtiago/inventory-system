import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { CreateStockMovement } from "@inventory/application/useCases/CreateStockMovementUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateStockMovementFactory() {
  const inventoryRepository = new PrismaInventoryRepository();
  const movementRepository = new PrismaStockMovementRepository();
  const catalogoService = makeCatalogService();
  const transactionManager = new PrismaTransactionManager();

  return new CreateStockMovement(
    inventoryRepository,
    movementRepository,
    catalogoService,
    transactionManager,
  );
}
