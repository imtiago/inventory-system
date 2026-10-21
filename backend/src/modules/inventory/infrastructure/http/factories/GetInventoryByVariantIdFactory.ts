import { GetInventoryByVariantIdUseCase } from "@inventory/application/useCases/queries/GetInventoryByVariantIdUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { prisma } from "@shared/prisma";

export function makeGetInventoryByVariantId() {
  const inventoryReadRepository = new PrismaInventoryRepository(prisma);

  return new GetInventoryByVariantIdUseCase(inventoryReadRepository);
}
