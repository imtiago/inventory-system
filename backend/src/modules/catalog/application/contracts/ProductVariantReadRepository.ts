// application/queries/ProductQuery.ts

import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export interface ProductVariantReadRepository {
  list(): Promise<ProductVariantDTO[]>;

  getByProductId(productId: string): Promise<ProductVariantDTO[]>;

  getById(id: string): Promise<ProductVariantDTO | null>;
}
