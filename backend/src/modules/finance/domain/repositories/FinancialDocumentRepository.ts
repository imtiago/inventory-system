import { FinancialDocument } from "../entities/FinancialDocument";

export interface FinancialDocumentRepository {
  create(data: FinancialDocument, tx?: any): Promise<FinancialDocument>;
  // markParcelAsPaid(parcelId: string, paidAt: Date): Promise<Parcel>;
}
