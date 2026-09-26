import { GetInventoryById } from "@inventory/application/useCases/GetInventoryById";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { prisma } from "@shared/prisma";

export function makeGetInventoryByIdUseCase() {
  const inventoryReadRepository = new PrismaInventoryRepository(prisma);

  return new GetInventoryById(inventoryReadRepository);
}
