import { GetSale } from "@sales/application/useCases/queries/GetSaleUseCase";
import { PrismaSaleReadRepository } from "@sales/infrastructure/prisma/contracts/PrismaSaleReadRepository";

export function makeGetSaleUseCase() {
  const repository = new PrismaSaleReadRepository();
  const useCase = new GetSale(repository);

  return useCase;
}
