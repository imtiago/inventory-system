import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeAdjustInventoryFactory } from "./AdjustInventoryFactory";
import { makeCreateInventoryLotUseCase } from "./CreateInventoryLotFactory";
import { ManagerCreateInventoryLotUseCase } from "@inventory/application/useCases/workflows/ManagerCreateInventoryLotUseCase";
import { makeGetInventoryByIdUseCase } from "./GetInventoryByIdFactory";

export function makeCreateInventoryLot1UseCase() {
  const getInventoryByIdUseCase = makeGetInventoryByIdUseCase();
  const createInventoryLotUseCase = makeCreateInventoryLotUseCase();
  const adjustInventoryUseCase = makeAdjustInventoryFactory();
  const transactionManager = new PrismaTransactionManager();

  return new ManagerCreateInventoryLotUseCase(
    getInventoryByIdUseCase,
    createInventoryLotUseCase,

    adjustInventoryUseCase,
    transactionManager,
  );
}
