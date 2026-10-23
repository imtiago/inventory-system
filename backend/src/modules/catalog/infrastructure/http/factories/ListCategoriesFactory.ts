import { ListCategoriesUseCase } from "@catalog/application/useCases/queries/ListCategoriesUseCase";
import { PrismaCategoryReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaCategoryReadRepository";

export function makeListCategoriesUseCase() {
  return new ListCategoriesUseCase(new PrismaCategoryReadRepository());
}
