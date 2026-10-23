import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { FinancialDocumentReadRepository } from "../../contracts/FinancialDocumentReadRepository";
import { ReceivableListFilters, ReceivableListResult } from "../../dto/ReceivableReadDTO";

export class ListReceivablesUseCase {
  constructor(
    private readonly repo: FinancialDocumentReadRepository,
    private readonly today: () => string = () => todayInBusinessTz(),
  ) {}

  async execute(filters: ReceivableListFilters, pagination: PaginationRequest): Promise<ReceivableListResult> {
    return this.repo.listReceivables(filters, pagination, this.today());
  }
}
