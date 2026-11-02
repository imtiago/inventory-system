import type { FinancialDocument } from "@finance/domain/entities/FinancialDocument";

/** Encargos de atraso de uma parcela num pagamento (centavos). */
export interface LateFeeCharge {
  principalRemainingCents: number;
  daysLate: number;
  fineCents: number;
  interestCents: number;
}

/**
 * Calcula multa e juros de atraso de uma parcela de um documento a receber na data do pagamento
 * (data de negócio). Documento `noLateFees` ou de outro tipo → encargos zero. Parcela inexistente → null.
 * Implementado pelo módulo de crédito (configurações de multa, juros e carência).
 */
export interface LateFeePolicy {
  chargeFor(document: FinancialDocument, parcelId: string, paymentDate: string): Promise<LateFeeCharge | null>;
}
