import { ProductVariantReadRepository } from "../contracts/ProductVariantReadRepository";
import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export class GetProductVariantByBarcodeUseCase {
  constructor(private productVariantRepo: ProductVariantReadRepository) {}

  async execute(barcode: string): Promise<ProductVariantDTO | null> {
    return this.productVariantRepo.getByBarcode(barcode);
  }
}
