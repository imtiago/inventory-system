import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { FinancialDocument } from "../entities/FinancialDocument";

export interface FinancialDocumentRepository extends ICrudRepository<FinancialDocument> {
  // create(data: FinancialDocument, tx?: any): Promise<FinancialDocument>;
  // markParcelAsPaid(parcelId: string, paidAt: Date): Promise<Parcel>;
}
