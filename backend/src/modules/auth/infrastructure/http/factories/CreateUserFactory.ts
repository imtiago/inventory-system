import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { CreateUser } from "@auth/application/useCases/CreateUser";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
export function makeCreateUserUseCase() {
  const repository = new PrismaUserRepository();
  const transactionManager = new PrismaTransactionManager();

  return new CreateUser(repository, transactionManager);
}
