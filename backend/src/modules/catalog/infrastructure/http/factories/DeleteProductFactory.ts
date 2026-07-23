import { DeleteProductUseCase } from "@catalog/application/useCases/DeleteProductUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeDeleteProductUseCase() {
  const repository = new PrismaProductRepository();
  const transactionManager = new PrismaTransactionManager();

  return new DeleteProductUseCase(repository, transactionManager);
}
