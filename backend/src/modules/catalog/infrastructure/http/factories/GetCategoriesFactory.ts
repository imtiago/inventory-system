import { PrismaCategoryRepository } from "@catalog/infrastructure/repositories/PrismaCategoryRepository";
import { GetCategoriesUseCase } from "../useCases/GetCategoriesUseCase";

export function makeGetCategoriesUseCase() {
  const repository = new PrismaCategoryRepository();
  return new GetCategoriesUseCase(repository);
}
