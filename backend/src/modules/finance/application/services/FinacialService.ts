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
}
