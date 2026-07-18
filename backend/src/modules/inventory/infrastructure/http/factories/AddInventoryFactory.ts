import { AddInventory } from "@inventory/application/useCases/AddInventory";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";

export function makeAddInventory() {
  const inventoryRepository = new PrismaInventoryRepository();

  return new AddInventory(inventoryRepository);
}
