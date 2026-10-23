import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { CreateUserUseCase } from "@auth/application/useCases/commands/CreateUserUseCase";
import { BcryptPasswordHasher } from "@auth/infrastructure/security/BcryptPasswordHasher";

export function makeCreateUserUseCase() {
  const repository = new PrismaUserRepository();
  const passwordHasher = new BcryptPasswordHasher();
  const transactionManager = new PrismaTransactionManager();

  return new CreateUserUseCase(repository, passwordHasher, transactionManager);
}
