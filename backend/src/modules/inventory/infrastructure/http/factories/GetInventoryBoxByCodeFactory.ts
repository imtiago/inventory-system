import { GetInventoryBoxByCode } from "@inventory/application/useCases/queries/GetInventoryBoxByCodeUseCase";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeGetInventoryBoxByCodeUseCase() {
  const inventoryBoxRepository = new PrismaInventoryBoxReadRepository();

  return new GetInventoryBoxByCode(inventoryBoxRepository);
}
