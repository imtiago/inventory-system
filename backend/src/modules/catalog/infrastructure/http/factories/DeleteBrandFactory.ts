import { DeleteBrandUseCase } from "@catalog/application/useCases/commands/DeleteBrandUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeDeleteBrandUseCase() {
  return new DeleteBrandUseCase(new PrismaBrandRepository(), new PrismaTransactionManager());
}
