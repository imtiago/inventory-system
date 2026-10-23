import { InventoryApplicationService } from "@inventory/application/services/InventoryApplicationService";
import { makeDispatchInventory } from "./DispatchInventoryFactory";
import { makeReceiveInventory } from "./ReceiveInventoryFactory";
import { makeReturnSaleStock } from "./ReturnSaleStockFactory";

export function makeInventoryService() {
  return new InventoryApplicationService(makeDispatchInventory(), makeReturnSaleStock(), makeReceiveInventory());
}
