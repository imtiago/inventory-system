import { CreateVariantUseCase } from "@catalog/application/useCases/CreateVariantUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/repositories/PrismaProductVariantRepository";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";

export function makeCreateVariantUseCase() {
  const productRepository = new PrismaProductRepository();
  const variantRepository = new PrismaProductVariantRepository();
  const codeGenerator = makeSequentialNumberGenerator();

  return new CreateVariantUseCase(
    productRepository,
    variantRepository,
    codeGenerator,
  );
}
