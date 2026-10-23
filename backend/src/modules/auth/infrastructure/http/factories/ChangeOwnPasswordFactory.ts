import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { ChangeOwnPasswordUseCase } from "@auth/application/useCases/commands/ChangeOwnPasswordUseCase";
import { BcryptPasswordHasher } from "@auth/infrastructure/security/BcryptPasswordHasher";
import { passwordChangeAttemptLimiter } from "@auth/infrastructure/security/LoginAttemptLimiter";

export function makeChangeOwnPasswordUseCase() {
  return new ChangeOwnPasswordUseCase(
    new PrismaUserRepository(),
    new BcryptPasswordHasher(),
    new PrismaTransactionManager(),
    passwordChangeAttemptLimiter,
  );
}
