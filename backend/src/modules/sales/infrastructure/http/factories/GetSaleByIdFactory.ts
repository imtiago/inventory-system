import { GetSaleByIdUseCase } from "@sales/application/useCases/queries/GetSaleByIdUseCase";
import { PrismaSaleReadRepository } from "@sales/infrastructure/prisma/contracts/PrismaSaleReadRepository";

export function makeGetSaleByIdUseCase() {
  const repository = new PrismaSaleReadRepository();
  const useCase = new GetSaleByIdUseCase(repository);

  return useCase;
}
