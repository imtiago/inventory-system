import { FinancialDocument } from "../entities/FinancialDocument";
import { FinancialOriginType } from "../enums/FinancialOriginType";
import { FinancialType } from "../enums/FinancialType";

export interface FinancialDocumentRepository {
  create(document: FinancialDocument): Promise<FinancialDocument>;
  /** Documento de uma origem (ex.: RECEIVABLE de SALE + id da venda), ou null. */
  findByOrigin(
    type: FinancialType,
    originType: FinancialOriginType,
    originId: string,
  ): Promise<FinancialDocument | null>;
  /** true se alguma parcela do documento tem pagamento registrado. */
  hasPayments(documentId: string): Promise<boolean>;
  /** Grava o status do documento. */
  update(document: FinancialDocument): Promise<FinancialDocument>;
}
