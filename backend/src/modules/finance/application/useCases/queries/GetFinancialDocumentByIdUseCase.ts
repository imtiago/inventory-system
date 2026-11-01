import { todayInBusinessTz } from "@shared/domain/businessDate";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { fromCents, toCents } from "@shared/domain/money";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { FINANCIAL_TYPE_LABEL } from "@finance/domain/enums/financialTypeLabels";
import { parcelLateFees } from "@credit/domain/lateFees";
import { FinancialDocumentReadRepository } from "../../contracts/FinancialDocumentReadRepository";
import type { LateFeeRatesReader } from "../../contracts/LateFeeRatesReader";
import { FinancialDetailBaseDTO, FinancialDocumentDetailDTO } from "../../dto/FinancialDocumentReadDTO";

/**
 * Detalhe de uma conta a receber ou a pagar; documento de outro tipo → 404.
 * A receber: cada parcela traz `lateFeesToday` (multa e juros se paga hoje).
 */
export class GetFinancialDocumentByIdUseCase<T extends FinancialType> {
  constructor(
    private readonly type: T,
    private readonly repo: FinancialDocumentReadRepository,
    private readonly today: () => string = () => todayInBusinessTz(),
    private readonly lateFeeRates: LateFeeRatesReader | null = null,
  ) {}

  async execute(id: string): Promise<FinancialDocumentDetailDTO<T>> {
    const today = this.today();
    const document = await this.repo.getById(this.type, id, today);
    if (!document) {
      throw new NotFoundError(
        `${FINANCIAL_TYPE_LABEL[this.type]} não encontrada.`,
        ErrorCodes.FINANCIAL_DOCUMENT_NOT_FOUND,
      );
    }
    if (this.type === FinancialType.RECEIVABLE && this.lateFeeRates) {
      await this.withLateFeesToday(document, today, this.lateFeeRates);
    }
    return document;
  }

  private async withLateFeesToday(document: FinancialDetailBaseDTO, today: string, reader: LateFeeRatesReader) {
    const exempt = document.noLateFees || document.status === FinancialStatus.CANCELED;
    const rates = exempt ? { graceDays: 0, fineBps: 0, monthlyInterestBps: 0 } : await reader.rates(document);
    for (const parcel of document.parcels) {
      const fees = parcelLateFees({
        amountCents: toCents(parcel.amount),
        dueDate: parcel.dueDate,
        payments: parcel.payments.map((p) => ({
          amountCents: toCents(p.amount),
          fineCents: toCents(p.fineAmount),
          interestCents: toCents(p.interestAmount),
          paymentDate: p.paymentDate,
          reversed: p.reversedAt !== null,
        })),
        paymentDate: today,
        rates,
        exempt,
      });
      parcel.lateFeesToday = {
        daysLate: fees.principalRemainingCents > 0 ? fees.daysLate : 0,
        fine: fromCents(fees.fineCents),
        interest: fromCents(fees.interestCents),
        totalDue: fromCents(fees.principalRemainingCents + fees.fineCents + fees.interestCents),
      };
    }
  }
}
