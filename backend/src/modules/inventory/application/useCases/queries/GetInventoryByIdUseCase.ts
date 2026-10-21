import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "../../../domain/entities/Inventory";

export class GetInventoryByIdUseCase {
  constructor(private repository: IInventoryRepository) {}

  async execute(inventoryId: string): Promise<Inventory | null> {
    return this.repository.findById(inventoryId);
  }
}
