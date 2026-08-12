import { GetInventoryDashboardUseCase } from "@inventory/application/useCases/GetInventoryDashboardUseCase";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeGetInventoryDashboardUseCase() {
  const inventoryReadRepository = new PrismaInventoryReadRepository();
  const transactionManager = new PrismaTransactionManager();

  return new GetInventoryDashboardUseCase(
    inventoryReadRepository,
    transactionManager,
  );
}
