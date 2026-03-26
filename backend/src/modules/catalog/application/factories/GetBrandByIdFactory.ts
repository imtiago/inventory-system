import { PrismaBrandRepository } from "@catalog/infrastructure/repositories/PrismaBrandRepository";
import { GetBrandByIdUseCase } from "../useCases/GetBrandByIdUseCase";

export function makeGetBrandByIdUseCase() {
  const repository = new PrismaBrandRepository();

  return new GetBrandByIdUseCase(repository);
}
