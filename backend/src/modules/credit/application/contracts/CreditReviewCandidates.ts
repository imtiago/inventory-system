import type { CustomerCredit } from "@credit/domain/customerCredit";

export interface CreditReviewCandidate extends CustomerCredit {
  customerName: string;
}

/**
 * Clientes elegíveis à revisão periódica: ficha `ACTIVE` (BLOCKED manual e SUSPENDED não são tocados)
 * que ainda não teve mudança `AUTO_REVIEW` na data de negócio `today` (rodar de novo no mesmo dia não faz nada).
 * Leitura sem trava, em ordem de id, paginada por `afterId`.
 */
export interface CreditReviewCandidates {
  list(input: { today: string; customerIds?: string[]; afterId?: string; limit: number }): Promise<CreditReviewCandidate[]>;
}
