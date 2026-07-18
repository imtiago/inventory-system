import { CreateBrandUseCase } from "@catalog/application/useCases/CreateBrandUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/repositories/PrismaBrandRepository";

export function makeCreateBrandUseCase() {
  const repository = new PrismaBrandRepository();
  return new CreateBrandUseCase(repository);
}
