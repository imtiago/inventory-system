import { CreateCategoryUseCase } from "@catalog/application/useCases/CreateCategoryUseCase";
import { PrismaCategoryRepository } from "@catalog/infrastructure/prisma/repositories/PrismaCategoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateCategoryUseCase() {
  const repository = new PrismaCategoryRepository();
  const transactionManager = new PrismaTransactionManager();

  return new CreateCategoryUseCase(repository, transactionManager);
}
