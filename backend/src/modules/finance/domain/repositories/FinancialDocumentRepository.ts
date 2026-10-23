import { FinancialDocument } from "../entities/FinancialDocument";

export interface FinancialDocumentRepository {
  create(document: FinancialDocument): Promise<FinancialDocument>;
}
