import { CreateInventoryLotUseCase } from "@inventory/application/useCases/CreateInventoryLotUseCase";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { prisma } from "@shared/prisma";

export function makeCreateInventoryLotUseCase() {
  const repository = new PrismaInventoryLotRepository(prisma);
  const transactionManager = new PrismaTransactionManager();

  return new CreateInventoryLotUseCase(repository, transactionManager);
}
