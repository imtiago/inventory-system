import { GetCustomerByIdUseCase } from "@customer/application/useCases/queries/GetCustomerByIdUseCase";
import { PrismaCustomerReadRepository } from "@customer/infrastructure/prisma/contracts/PrismaCustomerReadRepository";

export function makeGetCustomerUseCase() {
  const repository = new PrismaCustomerReadRepository();
  const useCase = new GetCustomerByIdUseCase(repository);

  return useCase;
}
