import { GetInventoryById } from "@inventory/application/useCases/queries/GetInventoryByIdUseCase";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { prisma } from "@shared/prisma";

export function makeGetInventoryByIdUseCase() {
  // const inventoryReadRepository = new PrismaInventoryReadRepository();
  const inventoryReadRepository = new PrismaInventoryRepository(prisma);

  return new GetInventoryById(inventoryReadRepository);
}
