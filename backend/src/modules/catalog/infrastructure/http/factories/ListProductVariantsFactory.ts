import { ListProductVariantsUseCase } from "@catalog/application/useCases/ListProductVariantsUseCase";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/repositories/PrismaProductVariantRepository";

export function makeListProductVariantsUseCase() {
  const repository = new PrismaProductVariantRepository();
  return new ListProductVariantsUseCase(repository);
}
