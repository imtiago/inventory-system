import { InventoryBoxReadRepository } from "../contracts/InventoryBoxReadRepository";
import { InventoryBoxDTO } from "../dto/InventoryBoxDTO";

export class GetInventoryBoxByCode {
  constructor(private repository: InventoryBoxReadRepository) {}

  async execute(code: string): Promise<InventoryBoxDTO | null> {
    return this.repository.getByCode(code);
  }
}
