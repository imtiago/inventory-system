// application/queries/ProductQuery.ts

import { FinancialDocumentDTO } from "../dto/FinancialDocumentDTO";

export interface FinancialDocumentReadRepository {
  listReceivables(): Promise<FinancialDocumentDTO[]>;
  listPayables(): Promise<FinancialDocumentDTO[]>;
  list(): Promise<FinancialDocumentDTO[]>;

  // getById(id: string): Promise<ProductListDTO | null>;
}
