import { UpdateCustomer } from "@customer/application/useCases/commands/UpdateCustomerUseCase";
import { PrismaCustomerRepository } from "@customer/infrastructure/prisma/repositories/PrismaCustomerRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeUpdateCustomerUseCase() {
  const repository = new PrismaCustomerRepository();
  const transactionManager = new PrismaTransactionManager();

  const useCase = new UpdateCustomer(repository, transactionManager);

  return useCase;
}
