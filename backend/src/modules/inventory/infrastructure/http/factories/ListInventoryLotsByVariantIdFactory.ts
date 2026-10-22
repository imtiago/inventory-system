import { GetInventoryLotsByVariantIdUseCase } from "@inventory/application/useCases/queries/GetInventoryLotsByVariantIdUseCase";
import { PrismaInventoryLotReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryLotReadRepository";

export function makeListInventoryLotsByVariantIdUseCase() {
  const inventoryReadRepository = new PrismaInventoryLotReadRepository();

  return new GetInventoryLotsByVariantIdUseCase(inventoryReadRepository);
}
