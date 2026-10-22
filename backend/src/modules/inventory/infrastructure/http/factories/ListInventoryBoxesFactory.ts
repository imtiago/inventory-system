import { ListInventoryBoxesUseCase } from "@inventory/application/useCases/queries/ListInventoryBoxesUseCase";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeListInventoryBoxesUseCase() {
  return new ListInventoryBoxesUseCase(new PrismaInventoryBoxReadRepository());
}
