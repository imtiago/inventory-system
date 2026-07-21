import { GetInventoryByVariantId } from "@inventory/application/useCases/GetInventoryByVariantId";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";

export function makeGetInventory() {
  const inventoryRepository = new PrismaInventoryRepository();

  return new GetInventoryByVariantId(inventoryRepository);
}
