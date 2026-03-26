// src/modules/catalog/application/factories/CreateProductFactory.ts
import { InventoryService } from "@inventory/application/factories/InventoryServiceFactory";
import { CreateProduct } from "../useCases/CreateProductUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";
import { PrismaCategoryRepository } from "@catalog/infrastructure/repositories/PrismaCategoryRepository";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/repositories/PrismaProductVariantRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeGetBrandByIdUseCase } from "./GetBrandByIdFactory";
export function makeCreateProductUseCase() {
  const brandRepo = makeGetBrandByIdUseCase();
  const repository = new PrismaProductRepository();
  const categoryRepo = new PrismaCategoryRepository();
  const productVariantRepo = new PrismaProductVariantRepository();
  const inventoryRepo = new PrismaInventoryRepository();
  const transactionManager = new PrismaTransactionManager();

  // const inventoryService = InventoryService.createDefault();

  return new CreateProduct(
    brandRepo,
    categoryRepo,
    repository,
    productVariantRepo,
    inventoryRepo,
    transactionManager,
  );
}
