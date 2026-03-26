import { PrismaProductVariantRepository } from "@catalog/infrastructure/repositories/PrismaProductVariantRepository";
import { ListProductVariantsUseCase } from "../useCases/ListProductVariantsUseCase";

export function makeListProductVariantsUseCase() {
  const repository = new PrismaProductVariantRepository();
  return new ListProductVariantsUseCase(repository);
}
