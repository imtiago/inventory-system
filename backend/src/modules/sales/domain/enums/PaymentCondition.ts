/** Condição de pagamento escolhida no fechamento da venda. */
export enum PaymentCondition {
  CASH = "CASH",
  PIX = "PIX",
  DEBIT_CARD = "DEBIT_CARD",
  CREDIT_CARD = "CREDIT_CARD",
  CREDIARIO = "CREDIARIO",
  /** Vendas parceladas antigas (`paymentTerms`), anteriores ao crediário. */
  LEGACY_INSTALLMENTS = "LEGACY_INSTALLMENTS",
}

/** Condições pagas no ato (pagamento `atCheckout` registrado na venda). */
export type ImmediatePaymentCondition =
  | PaymentCondition.CASH
  | PaymentCondition.PIX
  | PaymentCondition.DEBIT_CARD
  | PaymentCondition.CREDIT_CARD;

export const IMMEDIATE_PAYMENT_CONDITIONS: readonly ImmediatePaymentCondition[] = [
  PaymentCondition.CASH,
  PaymentCondition.PIX,
  PaymentCondition.DEBIT_CARD,
  PaymentCondition.CREDIT_CARD,
];
