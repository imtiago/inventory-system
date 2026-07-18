import { Inventory } from "../entities/Inventory";
import { StockMovement } from "../entities/StockMovement";

export interface InventoryRepository {
  findByVariant(productVariantId: string): Promise<Inventory | null>;

  save(inventory: Inventory): Promise<Inventory>;

  addMovement(movement: StockMovement): Promise<StockMovement>;
}
