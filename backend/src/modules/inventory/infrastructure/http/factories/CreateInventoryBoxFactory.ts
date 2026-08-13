import { CreateInventoryBoxUseCase } from "@inventory/application/useCases/CreateInventoryBoxUseCase";
import { PrismaInventoryBoxRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxRepository";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateInventoryBoxUseCase() {
  const inventoryBoxRepository = new PrismaInventoryBoxRepository();
  const codeGenerator = makeSequentialNumberGenerator();
  const transactionManager = new PrismaTransactionManager();

  return new CreateInventoryBoxUseCase(
    inventoryBoxRepository,
    codeGenerator,
    transactionManager,
  );
}
