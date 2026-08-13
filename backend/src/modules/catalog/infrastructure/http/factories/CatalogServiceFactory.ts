// src/modules/catalog/infrastructure/http/factories/CatalogServiceFactory.ts

import { CatalogApplicationService } from "@catalog/application/services/CatalogApplicationService";
// import { PrismaProductVariantRepository } from "../../prisma/repositories/PrismaProductVariantRepository";
import { GetProductVariantByIdUseCase } from "@catalog/application/useCases/GetProductVariantByIdUseCase";
import { GetProductVariantByBarcodeUseCase } from "@catalog/application/useCases/GetProductVariantByBarcodeUseCase";
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
  );
}
