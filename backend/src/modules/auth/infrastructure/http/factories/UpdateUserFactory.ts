import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { UpdateUserUseCase } from "@auth/application/useCases/commands/UpdateUserUseCase";

export function makeUpdateUserUseCase() {
  return new UpdateUserUseCase(new PrismaUserRepository(), new PrismaTransactionManager());
}
