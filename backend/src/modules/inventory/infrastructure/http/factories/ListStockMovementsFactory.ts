import { ListStockMovementsUseCase } from "@inventory/application/useCases/ListStockMovementsUseCase";
import { PrismaStockMovementReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaStockMovementReadRepository";

export function makeListStockMovementsUseCase() {
  const inventoryReadRepository = new PrismaStockMovementReadRepository();

  return new ListStockMovementsUseCase(inventoryReadRepository);
}
