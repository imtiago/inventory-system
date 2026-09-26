import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { CreateInventoryUseCase } from "@inventory/application/useCases/CreateInventoryUseCase";
import { CreateProductVariantInventoryUseCase } from "@inventory/application/useCases/CreateProductVariantInventoryUseCase";
import { GetInventoryByVariantId } from "@inventory/application/useCases/GetInventoryByVariantId";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { prisma } from "@shared/prisma";

export function makeGenerateInventoryByProductVariandIdUseCase() {
  const repository = new PrismaInventoryRepository(prisma);
  const transactionManager = new PrismaTransactionManager();

  const catalogService = makeCatalogService();

  const createInventoryUseCase = new CreateInventoryUseCase(
    repository,
    transactionManager,
  );
  const getInventoryByVariantIdUseCase = new GetInventoryByVariantId(
    repository,
  );

  return new CreateProductVariantInventoryUseCase(
    catalogService,
    getInventoryByVariantIdUseCase,
    createInventoryUseCase,
  );
}
