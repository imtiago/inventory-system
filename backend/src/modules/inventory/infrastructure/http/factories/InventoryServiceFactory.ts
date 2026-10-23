import { InventoryApplicationService } from "@inventory/application/services/InventoryApplicationService";
import { makeDispatchInventory } from "./DispatchInventoryFactory";
import { makeReturnSaleStock } from "./ReturnSaleStockFactory";

export function makeInventoryService() {
  return new InventoryApplicationService(makeDispatchInventory(), makeReturnSaleStock());
}
