import { PrismaProductVariantRepository } from "@catalog/infrastructure/repositories/PrismaProductVariantRepository";
import { CreateVariantUseCase } from "../useCases/CreateVariantUseCase";

export function makeCreateVariantUseCase() {
  const repository = new PrismaProductVariantRepository();
  return new CreateVariantUseCase(repository);
}
