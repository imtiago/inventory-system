import { ListCustomers } from "@customer/application/useCases/queries/ListCustomersUseCase";
import { PrismaCustomerReadRepository } from "@customer/infrastructure/prisma/contracts/PrismaCustomerReadRepository";

export function makeLisCustomerUseCase() {
  const repository = new PrismaCustomerReadRepository();
  const useCase = new ListCustomers(repository);

  return useCase;
}
