import { CreateCategoryUseCase } from "@catalog/application/useCases/commands/CreateCategoryUseCase";
import { PrismaCategoryRepository } from "@catalog/infrastructure/prisma/repositories/PrismaCategoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateCategoryUseCase() {
  return new CreateCategoryUseCase(new PrismaCategoryRepository(), new PrismaTransactionManager());
}
