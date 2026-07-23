import { ListProductVariantsUseCase } from "@catalog/application/useCases/ListProductVariantsUseCase";
import { PrismaProductReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductVariantReadRepository";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";

export function makeListProductVariantsUseCase() {
  const productRepository = new PrismaProductRepository();
  const repository = new PrismaProductReadRepository();
  return new ListProductVariantsUseCase(productRepository, repository);
}
