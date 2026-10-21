import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { CreateUserUseCase } from "@auth/application/useCases/commands/CreateUserUseCase";
import { prisma } from "@shared/prisma";
import { BcryptPasswordHasher } from "@auth/infrastructure/security/BcryptPasswordHasher";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";
export function makeCreateUserUseCase() {
  const repository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();

  const transactionManager = new PrismaTransactionManager();
  const codeGenerator = makeSequentialNumberGenerator();

  return new CreateUserUseCase(
    repository,
    passwordHasher,
    codeGenerator,
    transactionManager,
  );
}
