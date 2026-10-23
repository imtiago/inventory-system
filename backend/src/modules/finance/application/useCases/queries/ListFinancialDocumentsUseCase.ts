import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentReadRepository } from "../../contracts/FinancialDocumentReadRepository";
import { FinancialListFilters, FinancialListResult } from "../../dto/FinancialDocumentReadDTO";

/** Lista contas a receber ou a pagar (só do `type` da instância). */
export class ListFinancialDocumentsUseCase<T extends FinancialType> {
  constructor(
    private readonly type: T,
    private readonly repo: FinancialDocumentReadRepository,
    private readonly today: () => string = () => todayInBusinessTz(),
  ) {}

  async execute(filters: FinancialListFilters, pagination: PaginationRequest): Promise<FinancialListResult<T>> {
    return this.repo.list(this.type, filters, pagination, this.today());
  }
}
