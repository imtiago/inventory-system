import type { CreditExposure } from "@credit/domain/customerCredit";

/**
 * Saldo = Σ restante das parcelas de RECEIVABLE do cliente com documento OPEN/PARTIALLY_PAID (qualquer
 * origem, inclusive caderninho e "a combinar"); atraso = maior `today − dueDate` entre parcelas com saldo
 * (0 se nenhuma vencida), sem parcela "a combinar" nem dívida do caderninho (nunca bloqueiam o crediário).
 * `today` = data de negócio "YYYY-MM-DD".
 */
export interface CreditExposureReader {
  forCustomer(customerId: string, today: string): Promise<CreditExposure>;
}
