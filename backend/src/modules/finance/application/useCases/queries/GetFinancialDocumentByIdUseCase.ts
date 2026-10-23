import { todayInBusinessTz } from "@shared/domain/businessDate";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FINANCIAL_TYPE_LABEL } from "@finance/domain/enums/financialTypeLabels";
import { FinancialDocumentReadRepository } from "../../contracts/FinancialDocumentReadRepository";
import { FinancialDocumentDetailDTO } from "../../dto/FinancialDocumentReadDTO";

/** Detalhe de uma conta a receber ou a pagar; documento de outro tipo → 404. */
export class GetFinancialDocumentByIdUseCase<T extends FinancialType> {
  constructor(
    private readonly type: T,
    private readonly repo: FinancialDocumentReadRepository,
    private readonly today: () => string = () => todayInBusinessTz(),
  ) {}

  async execute(id: string): Promise<FinancialDocumentDetailDTO<T>> {
    const document = await this.repo.getById(this.type, id, this.today());
    if (!document) {
      throw new NotFoundError(
        `${FINANCIAL_TYPE_LABEL[this.type]} não encontrada.`,
        ErrorCodes.FINANCIAL_DOCUMENT_NOT_FOUND,
      );
    }
    return document;
  }
}
