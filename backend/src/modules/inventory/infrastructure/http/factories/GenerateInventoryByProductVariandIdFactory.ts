import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { CreateProductVariantInventoryUseCase } from "@inventory/application/useCases/commands/CreateProductVariantInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeGenerateInventoryByProductVariandIdUseCase() {
  return new CreateProductVariantInventoryUseCase(
    makeCatalogService(),
    new PrismaInventoryRepository(),
    new PrismaTransactionManager(),
  );
}
