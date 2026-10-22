import { InventoryReadRepository } from "../../contracts/InventoryReadRepository";

export class GetInventoryByIdReadUseCase {
  constructor(private repository: InventoryReadRepository) {}

  async execute(inventoryId: string) {
    return this.repository.getById(inventoryId);
  }
}
