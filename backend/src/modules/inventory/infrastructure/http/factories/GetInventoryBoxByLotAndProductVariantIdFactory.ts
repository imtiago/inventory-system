import { GetInventoryBoxByLotAndProductVariantId } from "@inventory/application/useCases/GetInventoryBoxByLotAndProductVariantIdUseCase";
import { PrismaInventoryBoxReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryBoxReadRepository";

export function makeGetInventoryBoxByLotAndProductVariantIdUseCase() {
  const inventoryBoxRepository = new PrismaInventoryBoxReadRepository();

  return new GetInventoryBoxByLotAndProductVariantId(inventoryBoxRepository);
}
