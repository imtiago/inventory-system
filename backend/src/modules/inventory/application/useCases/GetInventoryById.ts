import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";

export class GetInventoryById {
  constructor(private repository: IInventoryRepository) {}

  async execute(inventoryId: string): Promise<Inventory | null> {
    return this.repository.findById(inventoryId);
  }
}
