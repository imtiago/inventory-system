import { UpdateProductUseCase } from "@catalog/application/useCases/UpdateProductUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeUpdateProductUseCase() {
  const repository = new PrismaProductRepository();
  const transactionManager = new PrismaTransactionManager();

  return new UpdateProductUseCase(repository, transactionManager);
}
