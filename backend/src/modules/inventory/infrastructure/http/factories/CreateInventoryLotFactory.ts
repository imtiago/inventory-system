import { CreateInventoryLotUseCase } from "@inventory/application/useCases/CreateInventoryLotUseCase";
import { PrismaInventoryBoxRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxRepository";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateInventoryLotUseCase() {
  const repository = new PrismaInventoryLotRepository();
  // const codeGenerator = makeSequentialNumberGenerator();
  const transactionManager = new PrismaTransactionManager();

  return new CreateInventoryLotUseCase(
    repository,
    // codeGenerator,
    transactionManager,
  );
}
