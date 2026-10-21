import { GetProductVariantByIdUseCase } from "@catalog/application/useCases/queries/GetProductVariantByIdUseCase";
import { PrismaProductVariantReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductVariantReadRepository";

export function makeGetProductVariantByIdUseCase() {
  const repository = new PrismaProductVariantReadRepository();

  return new GetProductVariantByIdUseCase(repository);
}
