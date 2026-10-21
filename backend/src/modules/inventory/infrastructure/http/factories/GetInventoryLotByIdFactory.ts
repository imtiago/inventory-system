import { GetInventoryLotByIdUseCase } from "@inventory/application/useCases/queries/GetInventoryLotByIdUseCase";
import { PrismaInventoryLotReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryLotReadRepository";

export function makeGetInventoryLotById() {
  const inventoryReadRepository = new PrismaInventoryLotReadRepository();

  return new GetInventoryLotByIdUseCase(inventoryReadRepository);
}
