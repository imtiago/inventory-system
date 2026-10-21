import { GetInventoryLotsByVariantIdUseCase } from "@inventory/application/useCases/queries/GetInventoryLotsByVariantIdUseCase";
import { PrismaInventoryLotReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryLotReadRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeListInventoryLotsByVariantIdUseCase() {
  const inventoryReadRepository = new PrismaInventoryLotReadRepository();
  const transactionManager = new PrismaTransactionManager();

  return new GetInventoryLotsByVariantIdUseCase(
    inventoryReadRepository,
    transactionManager,
  );
}
