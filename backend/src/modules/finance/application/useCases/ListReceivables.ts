import { FinancialDocumentReadRepository } from "../contracts/FinancialDocumentReadRepository";
import { FinancialDocumentDTO } from "../dto/FinancialDocumentDTO";

export class ListReceivables {
  constructor(private repo: FinancialDocumentReadRepository) {}

  async execute(): Promise<FinancialDocumentDTO[]> {
    return this.repo.listReceivables();
  }
}
