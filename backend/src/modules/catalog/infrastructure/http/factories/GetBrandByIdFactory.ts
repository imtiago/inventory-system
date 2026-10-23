import { GetBrandByIdUseCase } from "@catalog/application/useCases/queries/GetBrandByIdUseCase";
import { PrismaBrandReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaBrandReadRepository";

export function makeGetBrandByIdUseCase() {
  return new GetBrandByIdUseCase(new PrismaBrandReadRepository());
}
