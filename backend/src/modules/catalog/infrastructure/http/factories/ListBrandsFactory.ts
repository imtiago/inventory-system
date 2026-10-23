import { ListBrandsUseCase } from "@catalog/application/useCases/queries/ListBrandsUseCase";
import { PrismaBrandReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaBrandReadRepository";

export function makeListBrandsUseCase() {
  return new ListBrandsUseCase(new PrismaBrandReadRepository());
}
