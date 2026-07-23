import { GetProductUseCase } from "@catalog/application/useCases/GetProductUseCase";
import { PrismaProductReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductVariantReadRepository";

export function makeGetProductUseCase() {
  const repository = new PrismaProductReadRepository();
  return new GetProductUseCase(repository);
}
