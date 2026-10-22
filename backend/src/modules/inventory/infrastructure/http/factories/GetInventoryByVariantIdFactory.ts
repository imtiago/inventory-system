import { GetInventoryByVariantIdUseCase } from "@inventory/application/useCases/queries/GetInventoryByVariantIdUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";

export function makeGetInventoryByVariantId() {
  const inventoryReadRepository = new PrismaInventoryRepository();

  return new GetInventoryByVariantIdUseCase(inventoryReadRepository);
}
