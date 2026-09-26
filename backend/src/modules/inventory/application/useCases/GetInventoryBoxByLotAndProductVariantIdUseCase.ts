import { InventoryBoxReadRepository } from "../contracts/InventoryBoxReadRepository";
interface IGetInventoryBoxByLotAndProductVariantId {
  batchNumber: string;
  productVariantId: string;
}
export class GetInventoryBoxByLotAndProductVariantId {
  constructor(private repository: InventoryBoxReadRepository) {}

  async execute(input: IGetInventoryBoxByLotAndProductVariantId) {
    return this.repository.getByLotAndProductVariantId(
      {
        page: 1,
        limit: 10,
      },
      {
        batchNumber: input.batchNumber,
        productVariantId: input.productVariantId,
      },
    );
  }
}
