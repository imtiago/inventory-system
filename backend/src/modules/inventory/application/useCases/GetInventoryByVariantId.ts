import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";

export class GetInventoryByVariantId {
  constructor(private repository: IInventoryRepository) {}

  async execute(productVariantId: string): Promise<Inventory | null> {
    return this.repository.findByProductVariantId(productVariantId);
  }
}
