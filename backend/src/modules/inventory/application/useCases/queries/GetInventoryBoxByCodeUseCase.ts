import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { IInventoryBoxOutput } from "../../dto/InventoryBoxDTO";

export class GetInventoryBoxByCodeUseCase {
  constructor(private repository: InventoryBoxReadRepository) {}

  async execute(code: string): Promise<IInventoryBoxOutput | null> {
    const data = await this.repository.getByCode(code);
    if (!data) return null;

    return {
      id: data.id,
      code: data.code,
    };
  }
}
