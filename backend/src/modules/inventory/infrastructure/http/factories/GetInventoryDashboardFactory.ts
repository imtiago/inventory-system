import { GetInventoryDashboardUseCase } from "@inventory/application/useCases/queries/GetInventoryDashboardUseCase";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeGetInventoryDashboardUseCase() {
  const inventoryReadRepository = new PrismaInventoryReadRepository();

  return new GetInventoryDashboardUseCase(inventoryReadRepository);
}
