import { GetInventoryById } from "@inventory/application/useCases/GetInventoryById";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeGetInventoryByIdUseCase() {
  const inventoryReadRepository = new PrismaInventoryReadRepository();

  return new GetInventoryById(inventoryReadRepository);
}
