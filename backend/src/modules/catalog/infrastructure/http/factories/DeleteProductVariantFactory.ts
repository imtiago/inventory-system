import { DeleteProductVariantUseCase } from "@catalog/application/useCases/DeleteProductVariantUseCase";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeDeleteProductVariantUseCase() {
  const repository = new PrismaProductVariantRepository();
  const transactionManager = new PrismaTransactionManager();

  return new DeleteProductVariantUseCase(repository, transactionManager);
}
