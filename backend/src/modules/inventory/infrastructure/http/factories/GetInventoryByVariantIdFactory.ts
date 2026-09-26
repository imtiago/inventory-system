import { GetInventoryByVariantId } from "@inventory/application/useCases/GetInventoryByVariantId";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { prisma } from "@shared/prisma";

export function makeGetInventoryByVariantId() {
  const inventoryReadRepository = new PrismaInventoryRepository(prisma);

  return new GetInventoryByVariantId(inventoryReadRepository);
}
