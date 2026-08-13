import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export interface CatalogService {
  getProductVariant(id: string): Promise<ProductVariantDTO | null>;
  getProductVariantByBarcode(
    barcode: string,
  ): Promise<ProductVariantDTO | null>;
}
