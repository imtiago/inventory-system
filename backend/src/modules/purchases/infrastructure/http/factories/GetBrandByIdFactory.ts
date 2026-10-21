import { GetBrandByIdUseCase } from "@catalog/application/useCases/GetBrandByIdUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/repositories/PrismaBrandRepository";

export function makeGetBrandByIdUseCase() {
  const repository = new PrismaBrandRepository();

  return new GetBrandByIdUseCase(repository);
}
