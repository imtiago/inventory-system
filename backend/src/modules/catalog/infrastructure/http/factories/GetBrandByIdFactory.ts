import { GetBrandByIdUseCase } from "@catalog/application/useCases/queries/GetBrandByIdUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";

export function makeGetBrandByIdUseCase() {
  const repository = new PrismaBrandRepository();

  return new GetBrandByIdUseCase(repository);
}
