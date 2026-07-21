import { ListProductVariantsUseCase } from "@catalog/application/useCases/ListProductVariantsUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";

export function makeListProductVariantsUseCase() {
  const productRepository = new PrismaProductRepository();
  const repository = new PrismaProductVariantRepository();
  return new ListProductVariantsUseCase(productRepository, repository);
}
