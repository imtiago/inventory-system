import type { CustomerCredit } from "@credit/domain/customerCredit";

/**
 * Ficha de crédito no `Customer`. Travas `FOR NO KEY UPDATE` (exigem transação; reentrantes): serializam
 * quem lê-e-grava a ficha sem bloquear inserções que referenciam o cliente (FK de venda/documento).
 * Ordem: pedido (se houver) → clientes ORDER BY id → (venda no crediário) inventários → lotes → alocações.
 */
export interface CustomerCreditRepository {
  /** Leitura sem trava (tela da ficha). */
  find(customerId: string): Promise<CustomerCredit | null>;
  lock(customerId: string): Promise<CustomerCredit | null>;
  /** Trava em ORDER BY id; ids inexistentes são ignorados; resultado em ordem de id. */
  lockMany(customerIds: string[]): Promise<CustomerCredit[]>;
  save(credit: CustomerCredit): Promise<void>;
}
