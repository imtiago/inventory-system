import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { IInventoryBoxOutput } from "../../dto/InventoryBoxDTO";

export class GetInventoryBoxByIdUseCase {
  constructor(private repository: InventoryBoxReadRepository) {}

  async execute(inventoryBoxId: string): Promise<IInventoryBoxOutput | null> {
    const data = await this.repository.getById(inventoryBoxId);
    if (!data) return null;

    return {
      id: data.id,
      code: data.code,
    };
  }
}
