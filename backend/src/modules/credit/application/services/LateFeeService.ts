import { parcelLateFees, type LateFeeRates } from "@credit/domain/lateFees";
import type { LateFeeCharge, LateFeePolicy } from "@finance/application/contracts/LateFeePolicy";
import type { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import type { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import type { LateFeeRatesReader } from "@finance/application/contracts/LateFeeRatesReader";

/**
 * Multa e juros de atraso no recebimento (spec §6): multa uma vez por parcela (≤ 2%), juros de mora
 * pró-rata desde o vencimento (ou desde o último pagamento que cobrou encargo), carência em dias,
 * tudo na data de negócio do pagamento. Só contas a receber sem `noLateFees`. Termos: os gravados na
 * venda do crediário (`SaleFinancing`); sem financiamento, os atuais das configurações.
 */
export class LateFeeService implements LateFeePolicy {
  constructor(private readonly rates: LateFeeRatesReader) {}

  async chargeFor(document: FinancialDocument, parcelId: string, paymentDate: string): Promise<LateFeeCharge | null> {
    const parcel = document.parcels.find((p) => p.id === parcelId);
    if (!parcel) return null;
    const exempt = document.type !== FinancialType.RECEIVABLE || document.noLateFees;
    const rules = exempt ? null : await this.rates.rates(document);
    return LateFeeService.forParcel(parcel, paymentDate, rules);
  }

  /** `rules` null = documento isento (só restante e dias de atraso). */
  static forParcel(parcel: FinancialParcel, paymentDate: string, rules: LateFeeRates | null): LateFeeCharge {
    return parcelLateFees({
      amountCents: parcel.amountCents,
      dueDate: parcel.dueDate,
      payments: parcel.payments.map((p) => ({
        amountCents: p.amountCents,
        fineCents: p.fineCents,
        interestCents: p.interestCents,
        paymentDate: p.paymentDate,
        reversed: p.isReversed,
      })),
      paymentDate,
      rates: rules ?? { graceDays: 0, fineBps: 0, monthlyInterestBps: 0 },
      exempt: rules === null,
    });
  }
}
