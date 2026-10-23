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
  /**
   * Trava (FOR UPDATE) e lê o documento com parcelas e pagamentos (para
   * registrar/estornar pagamento). null se não existe. Exige transação.
   */
  lockById(id: string): Promise<FinancialDocument | null>;
  /** true se alguma parcela de algum dos documentos tem pagamento ativo (não estornado). */
  hasPayments(documentIds: string[]): Promise<boolean>;
  /** Grava o status do documento. */
  update(document: FinancialDocument): Promise<FinancialDocument>;
}
