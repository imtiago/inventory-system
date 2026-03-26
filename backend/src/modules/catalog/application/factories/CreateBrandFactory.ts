import { PrismaBrandRepository } from "@catalog/infrastructure/repositories/PrismaBrandRepository";
import { CreateBrandUseCase } from "../useCases/CreateBrandUseCase";

export function makeCreateBrandUseCase() {
  const repository = new PrismaBrandRepository();
  return new CreateBrandUseCase(repository);
}
