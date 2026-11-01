import type { CreditSettingsReader } from "@credit/application/contracts/CreditSettingsReader";
import { parcelLateFees } from "@credit/domain/lateFees";
import type { LateFeeCharge, LateFeePolicy } from "@finance/application/contracts/LateFeePolicy";
import type { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import type { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import type { CreditRules } from "@credit/domain/creditRules";

/**
 * Multa e juros de atraso no recebimento (spec §6): multa uma vez por parcela (≤ 2%), juros de mora
 * pró-rata desde o vencimento (ou desde o último pagamento que cobrou encargo), carência em dias,
 * tudo na data de negócio do pagamento. Só contas a receber sem `noLateFees`.
 */
export class LateFeeService implements LateFeePolicy {
  constructor(private readonly settings: CreditSettingsReader) {}

  async chargeFor(document: FinancialDocument, parcelId: string, paymentDate: string): Promise<LateFeeCharge | null> {
    const parcel = document.parcels.find((p) => p.id === parcelId);
    if (!parcel) return null;
    const exempt = document.type !== FinancialType.RECEIVABLE || document.noLateFees;
    const rules = exempt ? null : (await this.settings.get()).rules;
    return LateFeeService.forParcel(parcel, paymentDate, rules);
  }

  /** `rules` null = documento isento (só restante e dias de atraso). */
  static forParcel(parcel: FinancialParcel, paymentDate: string, rules: CreditRules | null): LateFeeCharge {
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
