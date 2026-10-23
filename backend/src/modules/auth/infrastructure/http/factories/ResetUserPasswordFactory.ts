import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { ResetUserPasswordUseCase } from "@auth/application/useCases/commands/ResetUserPasswordUseCase";
import { BcryptPasswordHasher } from "@auth/infrastructure/security/BcryptPasswordHasher";

export function makeResetUserPasswordUseCase() {
  return new ResetUserPasswordUseCase(
    new PrismaUserRepository(),
    new BcryptPasswordHasher(),
    new PrismaTransactionManager(),
  );
}
