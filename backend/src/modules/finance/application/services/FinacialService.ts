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

export interface FinancialService {
  createSaleReceivable(input: CreateSaleReceivableInput): Promise<void>;
  /**
   * Cancela o documento a receber da venda. Lança ConflictError SALE_HAS_PAYMENTS
   * se alguma parcela tem pagamento. Venda sem documento: nada a fazer.
   */
  cancelSaleReceivable(saleId: string): Promise<void>;
}
