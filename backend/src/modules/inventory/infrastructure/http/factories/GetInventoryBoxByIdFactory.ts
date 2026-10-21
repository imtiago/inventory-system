import { GetInventoryBoxByIdUseCase } from "@inventory/application/useCases/queries/GetInventoryBoxByIdUseCase";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeGetInventoryBoxByIdUseCase() {
  const inventoryBoxRepository = new PrismaInventoryBoxReadRepository();

  return new GetInventoryBoxByIdUseCase(inventoryBoxRepository);
}
