import { ListCustomers } from "@customer/application/useCases/ListCustomers";
import { PrismaCustomerReadRepository } from "@customer/infrastructure/prisma/contracts/PrismaCustomerReadRepository";

export function makeLisCustomerUseCase() {
  const repository = new PrismaCustomerReadRepository();
  const useCase = new ListCustomers(repository);

  return useCase;
}
