import { CreateInventoryBoxUseCase } from "@inventory/application/useCases/CreateInventoryBoxUseCase";
import { PrismaInventoryBoxRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxRepository";
import { makeSequentialNumberGenerator } from "@shared/infrastructure/factories/SequentialNumberGenerator";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { prisma } from "@shared/prisma";

export function makeCreateInventoryBoxUseCase() {
  const inventoryBoxRepository = new PrismaInventoryBoxRepository(prisma);
  const codeGenerator = makeSequentialNumberGenerator();
  const transactionManager = new PrismaTransactionManager();

  return new CreateInventoryBoxUseCase(
    inventoryBoxRepository,
    codeGenerator,
    transactionManager,
  );
}
