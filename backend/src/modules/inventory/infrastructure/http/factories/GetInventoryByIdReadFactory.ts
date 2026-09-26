import { GetInventoryByIdRead } from "@inventory/application/useCases/GetInventoryByIdRead";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeGetInventoryByIdReadUseCase() {
  const inventoryReadRepository = new PrismaInventoryReadRepository();

  return new GetInventoryByIdRead(inventoryReadRepository);
}
