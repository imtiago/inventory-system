import { Inventory } from "../../domain/entities/Inventory";
import { InventoryReadRepository } from "../contracts/InventoryReadRepository";

export class GetInventoryByVariantId {
  constructor(private repository: InventoryReadRepository) {}

  async execute(productVariantId: string): Promise<Inventory | null> {
    return this.repository.getByVariantId(productVariantId);
  }
}
