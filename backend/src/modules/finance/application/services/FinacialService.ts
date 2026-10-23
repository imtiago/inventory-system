export interface SaleReceivableParcelInput {
  /** Valor da parcela (2 casas decimais; calculado em centavos pelo chamador). */
  amount: number;
  dueDate: Date;
}

export interface CreateSaleReceivableInput {
  saleId: string;
  customerId: string;
  parcels: SaleReceivableParcelInput[];
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
   * Cancela o documento a receber da venda. Lança ConflictError SALE_HAS_PAYMENTS
   * se alguma parcela tem pagamento. Venda sem documento: nada a fazer.
   */
  cancelSaleReceivable(saleId: string): Promise<void>;
  /** Cria o contas a pagar do pedido (PAYABLE, origem PURCHASE, parte SUPPLIER). */
  createPurchasePayable(input: CreatePurchasePayableInput): Promise<void>;
  /**
   * Trava e cancela o contas a pagar do pedido. Lança ConflictError
   * PURCHASE_HAS_PAYMENTS se houver pagamento ativo. Sem documento: nada a fazer.
   */
  cancelPurchasePayable(purchaseId: string): Promise<void>;
}
