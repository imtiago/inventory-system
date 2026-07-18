import { GetCategoriesUseCase } from "@catalog/application/useCases/GetCategoriesUseCase";
import { PrismaCategoryRepository } from "@catalog/infrastructure/repositories/PrismaCategoryRepository";

export function makeGetCategoriesUseCase() {
  const repository = new PrismaCategoryRepository();
  return new GetCategoriesUseCase(repository);
}
