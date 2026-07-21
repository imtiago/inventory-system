import { ListBrandsUseCase } from "@catalog/application/useCases/ListBrandsUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";

export function makeListBrandsUseCase() {
  const repository = new PrismaBrandRepository();
  return new ListBrandsUseCase(repository);
}
