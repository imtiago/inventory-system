import { GetCategoriesUseCase } from "@catalog/application/useCases/GetCategoriesUseCase";
import { PrismaCategoriesReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaCategoriesReadRepository";

export function makeGetCategoriesUseCase() {
  const repository = new PrismaCategoriesReadRepository();
  return new GetCategoriesUseCase(repository);
}
