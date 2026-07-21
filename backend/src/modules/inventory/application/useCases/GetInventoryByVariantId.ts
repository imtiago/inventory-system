// backend/src/modules/inventory/application/useCases/GetInventory.ts
import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";

export class GetInventoryByVariantId {
  constructor(private repository: InventoryRepository) {}

  async execute(productVariantId: string): Promise<Inventory | null> {
    return this.repository.findByVariant(productVariantId);
  }
}
