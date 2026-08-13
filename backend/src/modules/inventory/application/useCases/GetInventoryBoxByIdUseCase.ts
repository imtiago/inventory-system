import { InventoryBoxReadRepository } from "../contracts/InventoryBoxReadRepository";
import { InventoryBoxDTO } from "../dto/InventoryBoxDTO";

export class GetInventoryBoxById {
  constructor(private repository: InventoryBoxReadRepository) {}

  async execute(inventoryBoxId: string): Promise<InventoryBoxDTO | null> {
    return this.repository.getById(inventoryBoxId);
  }
}
