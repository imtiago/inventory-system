import { todayInBusinessTz } from "@shared/domain/businessDate";

/** Pagamentos do fechamento são estornados no cancelamento só até 7 dias corridos da venda (spec §10). */
export const CHECKOUT_REFUND_WINDOW_DAYS = 7;

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00.000Z`) / 86_400_000;

/**
 * Dia de negócio (America/Sao_Paulo) da venda até hoje ≤ 7 → estorno permitido.
 * Venda no dia 20: até o dia 27 sim; dia 28 não.
 */
export function isWithinCheckoutRefundWindow(saleCreatedAt: Date, now: Date = new Date()): boolean {
  return dayNumber(todayInBusinessTz(now)) - dayNumber(todayInBusinessTz(saleCreatedAt)) <= CHECKOUT_REFUND_WINDOW_DAYS;
}
