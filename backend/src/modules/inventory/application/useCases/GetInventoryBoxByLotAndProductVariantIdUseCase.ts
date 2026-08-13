import { InventoryBoxReadRepository } from "../contracts/InventoryBoxReadRepository";
import { InventoryBoxDTO } from "../dto/InventoryBoxDTO";
interface IGetInventoryBoxByLotAndProductVariantId {
  batchNumber: string;
  productVariantId: string;
}
export class GetInventoryBoxByLotAndProductVariantId {
  constructor(private repository: InventoryBoxReadRepository) {}

  async execute(
    input: IGetInventoryBoxByLotAndProductVariantId,
  ): Promise<InventoryBoxDTO | null> {
    return this.repository.getByLotAndProductVariantId(
      input.batchNumber,
      input.productVariantId,
    );
  }
}
