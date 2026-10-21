import { ListSalesUseCase } from "@sales/application/useCases/queries/ListSalesUseCase";
import { PrismaSaleReadRepository } from "@sales/infrastructure/prisma/contracts/PrismaSaleReadRepository";

export function makeListSaleUseCase() {
  const repository = new PrismaSaleReadRepository();
  const useCase = new ListSalesUseCase(repository);

  return useCase;
}
