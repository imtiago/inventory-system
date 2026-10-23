import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import {
  ReceivableDetailDTO,
  ReceivableListFilters,
  ReceivableListResult,
} from "../dto/ReceivableReadDTO";

export interface FinancialDocumentReadRepository {
  /** Lista filtrada, ordenada (próximo vencimento em aberto; pagos/cancelados por último) e com resumo. */
  listReceivables(
    filters: ReceivableListFilters,
    pagination: PaginationRequest,
    today: string,
  ): Promise<ReceivableListResult>;
  getReceivableById(id: string, today: string): Promise<ReceivableDetailDTO | null>;
}
