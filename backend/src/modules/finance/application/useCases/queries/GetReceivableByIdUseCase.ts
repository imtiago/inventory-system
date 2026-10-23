import { todayInBusinessTz } from "@shared/domain/businessDate";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { FinancialDocumentReadRepository } from "../../contracts/FinancialDocumentReadRepository";
import { ReceivableDetailDTO } from "../../dto/ReceivableReadDTO";

export class GetReceivableByIdUseCase {
  constructor(
    private readonly repo: FinancialDocumentReadRepository,
    private readonly today: () => string = () => todayInBusinessTz(),
  ) {}

  async execute(id: string): Promise<ReceivableDetailDTO> {
    const receivable = await this.repo.getReceivableById(id, this.today());
    if (!receivable) {
      throw new NotFoundError("Conta a receber não encontrada.", ErrorCodes.FINANCIAL_DOCUMENT_NOT_FOUND);
    }
    return receivable;
  }
}
