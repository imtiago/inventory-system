import { ListBrandsUseCase } from "@catalog/application/useCases/ListBrandsUseCase";
import { PrismaBrandReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaBrandReadRepository";

export function makeListBrandsUseCase() {
  const repository = new PrismaBrandReadRepository();
  return new ListBrandsUseCase(repository);
}
