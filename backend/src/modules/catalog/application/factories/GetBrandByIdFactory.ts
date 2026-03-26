import { PrismaBrandRepository } from "@catalog/infrastructure/repositories/PrismaBrandRepository";
import { GetBrandById } from "../useCases/GetBrandByIdUseCase";

export function makeGetBrandByIdUseCase() {
  const repository = new PrismaBrandRepository();

  return new GetBrandById(repository);
}
