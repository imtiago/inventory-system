import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
interface IGetInventoryBoxByLotAndProductVariantId {
  batchNumber: string;
  productVariantId: string;
  page?: number;
  limit?: number;
}
export class GetInventoryBoxByLotAndProductVariantIdUseCase {
  constructor(private repository: InventoryBoxReadRepository) {}

  async execute(input: IGetInventoryBoxByLotAndProductVariantId) {
    return this.repository.getByLotAndProductVariantId(
      {
        page: input.page ?? 1,
        limit: input.limit ?? 10,
      },
      {
        batchNumber: input.batchNumber,
        productVariantId: input.productVariantId,
      },
    );
  }
}
