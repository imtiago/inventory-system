import { PaginationParams } from "@shared/application/pagination";
import { FinancialDocumentReadRepository } from "../contracts/FinancialDocumentReadRepository";
import { FinancialDocumentDTO } from "../dto/FinancialDocumentDTO";

export class ListReceivables {
  constructor(private repo: FinancialDocumentReadRepository) {}

  async execute({
    page,
    limit,
  }: PaginationParams): Promise<FinancialDocumentDTO[]> {
    return this.repo.listReceivables({
      page,
      limit,
    });
  }
}
