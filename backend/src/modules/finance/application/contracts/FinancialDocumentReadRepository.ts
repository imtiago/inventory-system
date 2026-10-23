import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import {
  FinancialDocumentDetailDTO,
  FinancialListFilters,
  FinancialListResult,
} from "../dto/FinancialDocumentReadDTO";

/** Leitura de documentos financeiros de um tipo (a receber ou a pagar); outro tipo nunca aparece. */
export interface FinancialDocumentReadRepository {
  /** Lista filtrada, ordenada (próximo vencimento em aberto; pagos/cancelados por último) e com resumo. */
  list<T extends FinancialType>(
    type: T,
    filters: FinancialListFilters,
    pagination: PaginationRequest,
    today: string,
  ): Promise<FinancialListResult<T>>;
  getById<T extends FinancialType>(type: T, id: string, today: string): Promise<FinancialDocumentDetailDTO<T> | null>;
}
