// src/modules/catalog/infrastructure/http/factories/CatalogServiceFactory.ts

import { CatalogApplicationService } from "@catalog/application/services/CatalogApplicationService";
import { CatalogWriteApplicationService } from "@catalog/application/services/CatalogWriteApplicationService";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";
import { makeCreateProductUseCase } from "./CreateProductFactory";
import { makeCreateVariantUseCase } from "./CreateVariantFactory";
import { GetProductVariantByBarcodeUseCase } from "@catalog/application/useCases/queries/GetProductVariantByBarcodeUseCase";
import { GetProductVariantsByIdsUseCase } from "@catalog/application/useCases/queries/GetProductVariantsByIdsUseCase";
import { GetProductVariantByIdUseCase } from "@catalog/application/useCases/queries/GetProductVariantByIdUseCase";
import { PrismaProductVariantReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductVariantReadRepository";

export function makeCatalogService() {
  const repository = new PrismaProductVariantReadRepository();

  const getProductVariant = new GetProductVariantByIdUseCase(repository);
  const getProductVariantByBarcode = new GetProductVariantByBarcodeUseCase(
    repository,
  );

  return new CatalogApplicationService(
    getProductVariant,
    getProductVariantByBarcode,
    new GetProductVariantsByIdsUseCase(repository),
  );
}

export function makeCatalogWriteService() {
  return new CatalogWriteApplicationService(
    makeCreateProductUseCase(),
    makeCreateVariantUseCase(),
    new PrismaProductVariantRepository(),
  );
}
