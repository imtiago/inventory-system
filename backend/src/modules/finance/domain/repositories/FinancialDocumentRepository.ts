import { FinancialDocument } from "../entities/FinancialDocument";
import { FinancialOriginType } from "../enums/FinancialOriginType";
import { FinancialType } from "../enums/FinancialType";

export interface FinancialDocumentRepository {
  create(document: FinancialDocument): Promise<FinancialDocument>;
  /**
   * Trava (FOR UPDATE, em ordem de id) e lê todos os documentos de uma origem
   * (ex.: RECEIVABLE de SALE + id da venda). Exige transação.
   */
  lockByOrigin(
    type: FinancialType,
    originType: FinancialOriginType,
    originId: string,
  ): Promise<FinancialDocument[]>;
  /** true se alguma parcela de algum dos documentos tem pagamento registrado. */
  hasPayments(documentIds: string[]): Promise<boolean>;
  /** Grava o status do documento. */
  update(document: FinancialDocument): Promise<FinancialDocument>;
}
