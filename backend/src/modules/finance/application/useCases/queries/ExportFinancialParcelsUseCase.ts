import { todayInBusinessTz } from "@shared/domain/businessDate";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentReadRepository } from "../../contracts/FinancialDocumentReadRepository";
import { FinancialListFilters, FinancialParcelExportRow } from "../../dto/FinancialDocumentReadDTO";

/** Parcelas dos documentos da lista (mesmos filtros, sem paginação) para exportação. */
export class ExportFinancialParcelsUseCase<T extends FinancialType> {
  constructor(
    private readonly type: T,
    private readonly repo: FinancialDocumentReadRepository,
    private readonly today: () => string = () => todayInBusinessTz(),
  ) {}

  execute(filters: FinancialListFilters, maxRows: number): Promise<FinancialParcelExportRow[]> {
    return this.repo.listParcelsForExport(this.type, filters, this.today(), maxRows);
  }
}
