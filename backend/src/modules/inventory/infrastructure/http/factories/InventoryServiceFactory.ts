import { InventoryApplicationService } from "@inventory/application/services/InventoryApplicationService";
import { makeDispatchInventory } from "./DispatchInventoryFactory";

export function makeInventoryService() {
  return new InventoryApplicationService(makeDispatchInventory());
}
