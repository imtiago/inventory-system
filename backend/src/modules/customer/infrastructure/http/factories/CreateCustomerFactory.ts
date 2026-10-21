import { CreateCustomerUseCase } from "@customer/application/useCases/commands/CreateCustomerUseCase";
import { PrismaCustomerRepository } from "@customer/infrastructure/prisma/repositories/PrismaCustomerRepository";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateCustomerUseCase() {
  const repository = new PrismaCustomerRepository();
  const transactionManager = new PrismaTransactionManager();
  const codeGenerator = makeSequentialNumberGenerator();

  const useCase = new CreateCustomerUseCase(
    repository,
    codeGenerator,
    transactionManager,
  );

  return useCase;
}
