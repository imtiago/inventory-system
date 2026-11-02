import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";

export interface SaleReceivableParcelInput {
  /** Valor da parcela em centavos inteiros. */
  amountCents: number;
  dueDate: Date;
}

export interface CreateSaleReceivableInput {
  saleId: string;
  customerId: string;
  parcels: SaleReceivableParcelInput[];
}

export interface CreatePaidSaleReceivableInput {
  saleId: string;
  customerId: string;
  /** Valor pago no fechamento, em centavos. */
  amountCents: number;
  method: PaymentMethod;
  userId: string;
  /** Data de negócio "YYYY-MM-DD". */
  today: string;
}

export interface CreateCrediarioReceivableInput {
  saleId: string;
  customerId: string;
  userId: string;
  /** Data de negócio "YYYY-MM-DD". */
  today: string;
  /** Entrada paga no fechamento (`atCheckout`); null = sem entrada. */
  downPayment: { amountCents: number; method: PaymentMethod } | null;
  /** Parcelas do plano (centavos; vencimento "YYYY-MM-DD"). */
  parcels: { amountCents: number; dueDate: string }[];
}

export interface CancelSaleReceivableInput {
  saleId: string;
  /** Quem cancela (autor do estorno dos pagamentos do fechamento). */
  userId: string | null;
  /** false = fora da janela de estorno dos pagamentos do fechamento (7 dias). */
  checkoutRefundAllowed: boolean;
}

export interface CreatePurchasePayableInput {
  purchaseId: string;
  supplierId: string;
  /** Parcelas em centavos inteiros; vencimento à meia-noite UTC. */
  parcels: { amountCents: number; dueDate: Date }[];
}

export interface FinancialService {
  createSaleReceivable(input: CreateSaleReceivableInput): Promise<void>;
  /**
   * Venda paga no ato: documento com uma parcela vencendo hoje e pagamento `atCheckout`
   * na mesma transação (documento PAID).
   */
  createPaidSaleReceivable(input: CreatePaidSaleReceivableInput): Promise<void>;
  /**
   * Venda no crediário: entrada (se houver) como parcela vencendo hoje paga `atCheckout`
   * + parcelas do plano, na mesma transação.
   */
  createCrediarioReceivable(input: CreateCrediarioReceivableInput): Promise<void>;
  /**
   * Cancela o documento a receber da venda. Pagamento de parcela (não `atCheckout`)
   * → ConflictError SALE_HAS_PAYMENTS; pagamento do fechamento fora da janela →
   * CHECKOUT_REFUND_WINDOW_EXPIRED; dentro dela é estornado ("Venda cancelada").
   * Venda sem documento: nada a fazer.
   */
  cancelSaleReceivable(input: CancelSaleReceivableInput): Promise<void>;
  /** Cria o contas a pagar do pedido (PAYABLE, origem PURCHASE, parte SUPPLIER). */
  createPurchasePayable(input: CreatePurchasePayableInput): Promise<void>;
  /**
   * Trava e cancela o contas a pagar do pedido. Lança ConflictError
   * PURCHASE_HAS_PAYMENTS se houver pagamento ativo. Sem documento: nada a fazer.
   */
  cancelPurchasePayable(purchaseId: string): Promise<void>;
}
