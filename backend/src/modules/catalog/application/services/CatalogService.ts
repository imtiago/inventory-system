import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export interface CatalogService {
  getProductVariant(id: string): Promise<ProductVariantDTO | null>;
  /** Várias variantes numa consulta só (inexistentes ficam de fora). */
  getProductVariants(ids: string[]): Promise<ProductVariantDTO[]>;
  getProductVariantByBarcode(
    barcode: string,
  ): Promise<ProductVariantDTO | null>;
}
