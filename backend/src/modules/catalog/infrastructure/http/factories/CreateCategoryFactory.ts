import { PrismaCategoryRepository } from "@catalog/infrastructure/repositories/PrismaCategoryRepository";
import { CreateCategoryUseCase } from "../useCases/CreateCategoryUseCase";

export function makeCreateCategoryUseCase() {
  const repository = new PrismaCategoryRepository();
  return new CreateCategoryUseCase(repository);
}
