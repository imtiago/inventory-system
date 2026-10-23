import { DeleteCategoryUseCase } from "@catalog/application/useCases/commands/DeleteCategoryUseCase";
import { PrismaCategoryRepository } from "@catalog/infrastructure/prisma/repositories/PrismaCategoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeDeleteCategoryUseCase() {
  return new DeleteCategoryUseCase(new PrismaCategoryRepository(), new PrismaTransactionManager());
}
