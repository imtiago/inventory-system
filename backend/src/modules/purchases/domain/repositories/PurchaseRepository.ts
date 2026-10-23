import { Purchase } from "../entities/Purchase";

export interface PurchaseRepository {
  /** Grava pedido e itens. */
  create(purchase: Purchase): Promise<Purchase>;
  /**
   * Trava a linha do pedido (FOR UPDATE) e lê com itens; null se não existe.
   * Exige transação. Cancelamento e recebimento travam o pedido antes de
   * qualquer outra linha (depois o documento financeiro / as variantes).
   */
  lockById(id: string): Promise<Purchase | null>;
  /** Grava status e dados de cancelamento. */
  update(purchase: Purchase): Promise<Purchase>;
}
