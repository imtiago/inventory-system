import { GetInventoryByIdRead } from "@inventory/application/useCases/queries/GetInventoryByIdReadUseCase";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeGetInventoryByIdReadUseCase() {
  const inventoryReadRepository = new PrismaInventoryReadRepository();

  return new GetInventoryByIdRead(inventoryReadRepository);
}
