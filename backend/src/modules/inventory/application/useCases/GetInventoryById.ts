import { Inventory } from "../../domain/entities/Inventory";
import { InventoryReadRepository } from "../contracts/InventoryReadRepository";

export class GetInventoryById {
  constructor(private repository: InventoryReadRepository) {}

  async execute(inventoryId: string): Promise<Inventory | null> {
    return this.repository.getById(inventoryId);
  }
}
