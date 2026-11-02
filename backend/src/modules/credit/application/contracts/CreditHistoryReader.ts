import type { CreditHistory } from "@credit/domain/creditScore";

/**
 * Histórico de pagamento por cliente na janela `[today − months meses, today]` (datas de negócio).
 * Parcelas de RECEIVABLE do cliente em documentos não cancelados. Uma parcela "paga no período" é a
 * quitada (restante 0) cuja data de quitação (último pagamento ativo) cai na janela; `paidInstallments`
 * e `paidOnTime` contam o MESMO conjunto, então atrasos = paidInstallments − paidOnTime.
 * "Em dia" = quitada até vencimento + carência (`graceDays` das configurações).
 * Clientes inexistentes ficam fora do mapa.
 */
export interface CreditHistoryReader {
  forCustomers(customerIds: string[], today: string, months: number): Promise<Map<string, CreditHistory>>;
}
