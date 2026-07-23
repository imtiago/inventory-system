import { CreateCustomer } from "@customer/application/useCases/CreateCustomer";
import { PrismaCustomerRepository } from "@customer/infrastructure/prisma/repositories/PrismaCustomerRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateCustomerUseCase() {
  const repository = new PrismaCustomerRepository();
  const transactionManager = new PrismaTransactionManager();

  const useCase = new CreateCustomer(repository, transactionManager);

  return useCase;
}
