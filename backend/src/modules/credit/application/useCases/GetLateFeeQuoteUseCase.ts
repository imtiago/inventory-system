import type { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import type { LateFeePolicy } from "@finance/application/contracts/LateFeePolicy";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { fromCents } from "@shared/domain/money";
import { ErrorCodes, NotFoundError, ValidationError } from "@shared/domain/errors";

export interface LateFeeQuoteDTO {
  principalRemaining: number;
  daysLate: number;
  fine: number;
  interest: number;
  totalDue: number;
}

export interface GetLateFeeQuoteInput {
  documentId: string;
  parcelId: string;
  /** "YYYY-MM-DD"; padrão = hoje (data de negócio em São Paulo). */
  paymentDate?: string;
}

/** Prévia dos encargos de uma parcela a receber (o pagamento recalcula sob a trava). */
export class GetLateFeeQuoteUseCase {
  constructor(
    private readonly documents: { findById(id: string): Promise<FinancialDocument | null> },
    private readonly lateFees: LateFeePolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: GetLateFeeQuoteInput): Promise<LateFeeQuoteDTO> {
    const today = todayInBusinessTz(this.now());
    const paymentDate = input.paymentDate ?? today;
    if (paymentDate > today) {
      throw new ValidationError("Dados inválidos.", [
        { field: "paymentDate", message: "A data do pagamento não pode ser futura." },
      ]);
    }
    const document = await this.documents.findById(input.documentId);
    if (!document || document.type !== FinancialType.RECEIVABLE) {
      throw new NotFoundError("Conta a receber não encontrada.", ErrorCodes.FINANCIAL_DOCUMENT_NOT_FOUND);
    }
    const charge = await this.lateFees.chargeFor(document, input.parcelId, paymentDate);
    if (!charge) throw new NotFoundError("Parcela não encontrada.", ErrorCodes.PARCEL_NOT_FOUND);
    return {
      principalRemaining: fromCents(charge.principalRemainingCents),
      daysLate: charge.daysLate,
      fine: fromCents(charge.fineCents),
      interest: fromCents(charge.interestCents),
      totalDue: fromCents(charge.principalRemainingCents + charge.fineCents + charge.interestCents),
    };
  }
}
