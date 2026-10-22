import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { InventoryBoxDTO } from "../../dto/InventoryBoxDTO";
import { InventoryBoxReadMapper } from "../../mappers/InventoryBoxReadMapper";

export class GetInventoryBoxByCodeUseCase {
  constructor(private repository: InventoryBoxReadRepository) {}

  async execute(code: string): Promise<InventoryBoxDTO | null> {
    const data = await this.repository.getByCode(code);
    if (!data) return null;

    return InventoryBoxReadMapper.toDTO(data);
  }
}
