import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaCategoryRepository } from "@catalog/infrastructure/prisma/repositories/PrismaCategoryRepository";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";
import { PrismaProductReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductReadRepository";
import { CreateProductUseCase } from "@catalog/application/useCases/commands/CreateProductUseCase";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";

export function makeCreateProductUseCase() {
  return new CreateProductUseCase(
    new PrismaBrandRepository(),
    new PrismaCategoryRepository(),
    new PrismaProductRepository(),
    new PrismaProductVariantRepository(),
    new PrismaProductReadRepository(),
    makeSequentialNumberGenerator(),
    new PrismaTransactionManager(),
  );
}
