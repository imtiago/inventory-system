import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { prisma } from "@shared/prisma";
import { makeAdjustInventoryFactory } from "./AdjustInventoryFactory";
import { makeCreateInventoryLotUseCase } from "./CreateInventoryLotFactory";
import { CreateInventoryLotUseCase1 } from "@inventory/application/useCases/commands/CreateInventoryLotUseCase1";

export function makeCreateInventoryLot1UseCase() {
  const createInventoryLotUseCase = makeCreateInventoryLotUseCase();
  const adjustInventoryUseCase = makeAdjustInventoryFactory();
  const transactionManager = new PrismaTransactionManager();

  return new CreateInventoryLotUseCase1(
    createInventoryLotUseCase,
    adjustInventoryUseCase,
    transactionManager,
  );
}
