export type ReviewScope = { kind: "ALL" } | { kind: "CATEGORY" | "PRODUCT" | "VARIANT"; id: string };

/**
 * Gatilhos da revisão de preços. Rodam DENTRO da transação de quem chama (estoque, configuração, preço):
 * rollback dela → nenhuma revisão.
 */
export interface PriceReviewTrigger {
  /** O custo médio da variante mudou (entrada de estoque, recebimento de compra/NF-e, estorno). */
  costChanged(variantId: string): Promise<void>;
  /** Configuração, despesa ou margem-alvo mudou. Quem chama já segura a trava exclusiva das configurações. */
  settingsChanged(scope: ReviewScope): Promise<void>;
  /** O preço de venda da variante foi alterado: a pendente dela é resolvida como APPLIED. */
  priceApplied(variantId: string, userId: string): Promise<void>;
}

export class NoopPriceReviewTrigger implements PriceReviewTrigger {
  async costChanged(): Promise<void> {}
  async settingsChanged(): Promise<void> {}
  async priceApplied(): Promise<void> {}
}
