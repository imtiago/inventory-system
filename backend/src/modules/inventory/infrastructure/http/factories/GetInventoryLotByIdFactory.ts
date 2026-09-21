import { GetInventoryLotByIdUseCase } from "@inventory/application/useCases/GetInventoryLotByIdUseCase";
import { PrismaInventoryLotReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryLotReadRepository";

export function makeGetInventoryLotById() {
  const inventoryReadRepository = new PrismaInventoryLotReadRepository();

  return new GetInventoryLotByIdUseCase(inventoryReadRepository);
}
