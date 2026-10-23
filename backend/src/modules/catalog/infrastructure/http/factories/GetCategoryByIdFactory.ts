import { GetCategoryByIdUseCase } from "@catalog/application/useCases/queries/GetCategoryByIdUseCase";
import { PrismaCategoryReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaCategoryReadRepository";

export function makeGetCategoryByIdUseCase() {
  return new GetCategoryByIdUseCase(new PrismaCategoryReadRepository());
}
