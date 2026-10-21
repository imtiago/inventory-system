import { ProductVariantDTO } from "../dto/PurchaseListDTO";

export interface CatalogService {
  getProductVariant(id: string): Promise<ProductVariantDTO | null>;
}
