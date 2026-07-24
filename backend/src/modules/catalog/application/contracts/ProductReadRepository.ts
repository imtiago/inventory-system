// application/queries/ProductQuery.ts

import { ProductListDTO } from "../dto/ProductListDTO";

interface FindManyProductsParams {
  page: number;
  limit: number;
}

interface FindManyProductsResult {
  data: ProductListDTO[];
  total: number;
}

export interface ProductReadRepository {
  list({}: FindManyProductsParams): Promise<FindManyProductsResult>;

  getById(id: string): Promise<ProductListDTO | null>;
}
