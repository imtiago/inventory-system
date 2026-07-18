// src/modules/catalog/application/factories/CreateProductFactory.ts
import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";
import { PrismaCategoryRepository } from "@catalog/infrastructure/repositories/PrismaCategoryRepository";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/repositories/PrismaProductVariantRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { CreateProductUseCase } from "@catalog/application/useCases/CreateProductUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/repositories/PrismaBrandRepository";
export function makeCreateProductUseCase() {
  const brandRepo = new PrismaBrandRepository();
  const repository = new PrismaProductRepository();
  const categoryRepo = new PrismaCategoryRepository();
  const productVariantRepo = new PrismaProductVariantRepository();
  const transactionManager = new PrismaTransactionManager();

  // const inventoryService = InventoryService.createDefault();

  return new CreateProductUseCase(
    brandRepo,
    categoryRepo,
    repository,
    productVariantRepo,
    transactionManager,
  );
}
