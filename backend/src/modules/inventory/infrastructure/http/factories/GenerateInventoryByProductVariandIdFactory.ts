import { CreateInventoryUseCase } from "@inventory/application/useCases/CreateInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeGenerateInventoryByProductVariandIdUseCase() {
  const repository = new PrismaInventoryRepository();
  const transactionManager = new PrismaTransactionManager();

  return new CreateInventoryUseCase(repository, transactionManager);
}
