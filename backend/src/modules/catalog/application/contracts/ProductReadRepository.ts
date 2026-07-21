// application/queries/ProductQuery.ts

import { ProductListDTO } from "../dto/ProductListDTO";

export interface ProductReadRepository {
  list(): Promise<ProductListDTO[]>;

  getById(id: string): Promise<ProductListDTO | null>;
}
