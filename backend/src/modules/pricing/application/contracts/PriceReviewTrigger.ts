export type ReviewScope = { kind: "ALL" } | { kind: "CATEGORY" | "PRODUCT" | "VARIANT"; id: string };

/** Avisa que configurações ou preços mudaram e os preços sugeridos precisam ser revistos (a Task 5 troca o no-op). */
export interface PriceReviewTrigger {
  settingsChanged(scope: ReviewScope): Promise<void>;
  /** O preço de venda da variante foi alterado (VariantPriceChanged). */
  priceApplied(variantId: string): Promise<void>;
}

export class NoopPriceReviewTrigger implements PriceReviewTrigger {
  async settingsChanged(): Promise<void> {}
  async priceApplied(): Promise<void> {}
}
