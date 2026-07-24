// src/modules/catalog/infrastructure/http/factories/CatalogServiceFactory.ts

import { CatalogApplicationService } from "@catalog/application/services/CatalogApplicationService";
import { PrismaProductVariantRepository } from "../../prisma/repositories/PrismaProductVariantRepository";
import { GetProductVariantByIdUseCase } from "@catalog/application/useCases/GetProductVariantByIdUseCase";

export function makeCatalogService() {
  const repository = new PrismaProductVariantRepository();

  const getProductVariant = new GetProductVariantByIdUseCase(repository);

  return new CatalogApplicationService(getProductVariant);
}
