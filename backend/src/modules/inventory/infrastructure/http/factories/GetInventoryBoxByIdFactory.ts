import { GetInventoryBoxById } from "@inventory/application/useCases/GetInventoryBoxByIdUseCase";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeGetInventoryBoxByIdUseCase() {
  const inventoryBoxRepository = new PrismaInventoryBoxReadRepository();

  return new GetInventoryBoxById(inventoryBoxRepository);
}
