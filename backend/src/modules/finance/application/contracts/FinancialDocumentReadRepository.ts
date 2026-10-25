import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import {
  FinancialDocumentDetailDTO,
  FinancialListFilters,
  FinancialListResult,
  FinancialParcelExportRow,
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
  /**
   * Parcelas (uma linha cada) dos documentos que passam nos MESMOS filtros da lista, sem paginação.
   * Mais de `maxRows` parcelas → ExportTooLargeError.
   */
  listParcelsForExport<T extends FinancialType>(
    type: T,
    filters: FinancialListFilters,
    today: string,
    maxRows: number,
  ): Promise<FinancialParcelExportRow[]>;
  getById<T extends FinancialType>(type: T, id: string, today: string): Promise<FinancialDocumentDetailDTO<T> | null>;
}
