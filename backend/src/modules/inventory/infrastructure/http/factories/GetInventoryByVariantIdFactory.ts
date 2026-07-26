import { GetInventoryByVariantId } from "@inventory/application/useCases/GetInventoryByVariantId";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeGetInventoryByVariantId() {
  const inventoryReadRepository = new PrismaInventoryReadRepository();

  return new GetInventoryByVariantId(inventoryReadRepository);
}
