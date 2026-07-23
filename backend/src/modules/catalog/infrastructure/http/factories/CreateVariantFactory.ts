import { CreateVariantUseCase } from "@catalog/application/useCases/CreateVariantUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateVariantUseCase() {
  const productRepository = new PrismaProductRepository();
  const variantRepository = new PrismaProductVariantRepository();
  const codeGenerator = makeSequentialNumberGenerator();
  const transactionManager = new PrismaTransactionManager();

  return new CreateVariantUseCase(
    productRepository,
    variantRepository,
    codeGenerator,
    transactionManager,
  );
}
