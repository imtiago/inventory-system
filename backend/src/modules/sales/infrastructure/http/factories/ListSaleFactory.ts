import { ListSales } from "@sales/application/useCases/ListSales";
import { PrismaSaleReadRepository } from "@sales/infrastructure/prisma/contracts/PrismaSaleReadRepository";

export function makeListSaleUseCase() {
  const repository = new PrismaSaleReadRepository();
  const useCase = new ListSales(repository);

  return useCase;
}
