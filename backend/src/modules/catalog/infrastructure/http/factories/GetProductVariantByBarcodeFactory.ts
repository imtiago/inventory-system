import { GetProductVariantByBarcodeUseCase } from "@catalog/application/useCases/queries/GetProductVariantByBarcodeUseCase";
import { PrismaProductVariantReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductVariantReadRepository";

export function makeGetProductVariantByBarcodeUseCase() {
  const repository = new PrismaProductVariantReadRepository();

  return new GetProductVariantByBarcodeUseCase(repository);
}
