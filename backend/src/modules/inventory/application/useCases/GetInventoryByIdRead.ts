import { InventoryReadRepository } from "../contracts/InventoryReadRepository";

export class GetInventoryByIdRead {
  constructor(private repository: InventoryReadRepository) {}

  async execute(inventoryId: string) {
    return this.repository.getById(inventoryId);
  }
}
