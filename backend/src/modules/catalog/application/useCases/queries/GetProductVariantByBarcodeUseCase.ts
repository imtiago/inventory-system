import { ProductVariantReadRepository } from "@catalog/application/contracts/ProductVariantReadRepository";
import { ProductVariantDTO } from "@catalog/application/dto/ProductVariantDTO";

export class GetProductVariantByBarcodeUseCase {
  constructor(private productVariantRepo: ProductVariantReadRepository) {}

  async execute(barcode: string): Promise<ProductVariantDTO | null> {
    return this.productVariantRepo.getByBarcode(barcode);
  }
}
