// src/modules/catalog/infrastructure/http/factories/CatalogServiceFactory.ts

import { CatalogApplicationService } from "@catalog/application/services/CatalogApplicationService";
import { PrismaProductVariantRepository } from "../../prisma/repositories/PrismaProductVariantRepository";
import { GetProductVariantUseCase } from "@catalog/application/useCases/GetProductVariantUseCase";

export function makeCatalogService() {
  const repository = new PrismaProductVariantRepository();

  const getProductVariant = new GetProductVariantUseCase(repository);

  return new CatalogApplicationService(getProductVariant);
}
