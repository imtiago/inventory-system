import { GetInventoryBoxByCodeUseCase } from "@inventory/application/useCases/queries/GetInventoryBoxByCodeUseCase";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeGetInventoryBoxByCodeUseCase() {
  const inventoryBoxRepository = new PrismaInventoryBoxReadRepository();

  return new GetInventoryBoxByCodeUseCase(inventoryBoxRepository);
}
