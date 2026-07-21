import { CreateCategoryUseCase } from "@catalog/application/useCases/CreateCategoryUseCase";
import { PrismaCategoryRepository } from "@catalog/infrastructure/prisma/repositories/PrismaCategoryRepository";

export function makeCreateCategoryUseCase() {
  const repository = new PrismaCategoryRepository();
  return new CreateCategoryUseCase(repository);
}
