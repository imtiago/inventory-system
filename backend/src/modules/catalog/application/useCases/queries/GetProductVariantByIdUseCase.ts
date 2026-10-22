import { ProductVariantReadRepository } from "@catalog/application/contracts/ProductVariantReadRepository";
import { IProductVariantOutput } from "@catalog/application/dto/ProductVariantDTO";

export class GetProductVariantByIdUseCase {
  constructor(private productVariantRepo: ProductVariantReadRepository) {}

  async execute(id: string): Promise<IProductVariantOutput | null> {
    const data = await this.productVariantRepo.getById(id);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      barcode: data.barcode,
      code: data.code,
      productId: data.productId,
      salePrice: data.salePrice,
    };
  }
}
