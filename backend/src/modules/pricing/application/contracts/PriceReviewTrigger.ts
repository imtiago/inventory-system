export type ReviewScope = { kind: "ALL" } | { kind: "CATEGORY" | "PRODUCT" | "VARIANT"; id: string };

/**
 * Gatilhos da revisão de preços. Rodam DENTRO da transação de quem chama (estoque, configuração, preço):
 * rollback dela → nenhuma revisão.
 */
export interface PriceReviewTrigger {
  /**
   * Trava COMPARTILHADA das configurações de preço. Todo caminho de estoque que pode mudar o custo médio chama
   * ANTES da primeira trava de inventário: quem espera uma escrita de configuração (exclusiva) não segura linha
   * de estoque, e quem já segura a compartilhada nunca espera quem está na fila dela (sem ciclo).
   */
  beforeCostChange(): Promise<void>;
  /** O custo médio da variante mudou (entrada de estoque, recebimento de compra/NF-e, estorno). */
  costChanged(variantId: string): Promise<void>;
  /** Configuração, despesa ou margem-alvo mudou. Quem chama já segura a trava exclusiva das configurações. */
  settingsChanged(scope: ReviewScope): Promise<void>;
  /** O preço de venda da variante foi alterado: a pendente dela é resolvida como APPLIED. */
  priceApplied(variantId: string, userId: string): Promise<void>;
}

export class NoopPriceReviewTrigger implements PriceReviewTrigger {
  async beforeCostChange(): Promise<void> {}
  async costChanged(): Promise<void> {}
  async settingsChanged(): Promise<void> {}
  async priceApplied(): Promise<void> {}
}
