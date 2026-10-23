import { UpdateCategoryUseCase } from "@catalog/application/useCases/commands/UpdateCategoryUseCase";
import { PrismaCategoryReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaCategoryReadRepository";
import { PrismaCategoryRepository } from "@catalog/infrastructure/prisma/repositories/PrismaCategoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeUpdateCategoryUseCase() {
  return new UpdateCategoryUseCase(
    new PrismaCategoryRepository(),
    new PrismaCategoryReadRepository(),
    new PrismaTransactionManager(),
  );
}
