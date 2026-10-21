import { GetCustomer } from "@customer/application/useCases/queries/GetCustomerUseCase";
import { PrismaCustomerReadRepository } from "@customer/infrastructure/prisma/contracts/PrismaCustomerReadRepository";

export function makeGetCustomerUseCase() {
  const repository = new PrismaCustomerReadRepository();
  const useCase = new GetCustomer(repository);

  return useCase;
}
