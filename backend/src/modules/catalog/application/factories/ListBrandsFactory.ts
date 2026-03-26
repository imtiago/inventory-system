import { PrismaBrandRepository } from "@catalog/infrastructure/repositories/PrismaBrandRepository";
import { ListBrandsUseCase } from "../useCases/ListBrandsUseCase";

export function makeListBrandsUseCase() {
  const repository = new PrismaBrandRepository();
  return new ListBrandsUseCase(repository);
}
