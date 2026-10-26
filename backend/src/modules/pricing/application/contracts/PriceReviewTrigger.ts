export type ReviewScope = { kind: "ALL" } | { kind: "CATEGORY" | "PRODUCT" | "VARIANT"; id: string };

/** Avisa que configurações mudaram e os preços sugeridos precisam ser revistos (a Task 5 troca o no-op). */
export interface PriceReviewTrigger {
  settingsChanged(scope: ReviewScope): Promise<void>;
}

export class NoopPriceReviewTrigger implements PriceReviewTrigger {
  async settingsChanged(): Promise<void> {}
}
