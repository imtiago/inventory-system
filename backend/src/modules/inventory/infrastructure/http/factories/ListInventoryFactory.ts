import { ListInvetoryUseCase } from "@inventory/application/useCases/queries/ListInvetoryUseCase";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeListInventoryUseCase() {
  const inventoryReadRepository = new PrismaInventoryReadRepository();

  return new ListInvetoryUseCase(inventoryReadRepository);
}
