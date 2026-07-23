import { GetSale } from "@sales/application/useCases/GetSale";
import { PrismaSaleReadRepository } from "@sales/infrastructure/prisma/contracts/PrismaSaleReadRepository";

export function makeGetSaleUseCase() {
  const repository = new PrismaSaleReadRepository();
  const useCase = new GetSale(repository);

  return useCase;
}
