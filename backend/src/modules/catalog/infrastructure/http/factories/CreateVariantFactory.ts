import { CreateVariantUseCase } from "@catalog/application/useCases/CreateVariantUseCase";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/repositories/PrismaProductVariantRepository";

export function makeCreateVariantUseCase() {
  const repository = new PrismaProductVariantRepository();
  return new CreateVariantUseCase(repository);
}
