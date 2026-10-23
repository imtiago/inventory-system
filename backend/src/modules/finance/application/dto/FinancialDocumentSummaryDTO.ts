// Resumo de um documento financeiro (a receber ou a pagar) embutido no detalhe
// da origem (ex.: pedido de compra). Mesmas regras de status das contas a receber.

export interface FinancialParcelSummaryDTO {
  id: string;
  number: number;
  amount: number;
  /** "YYYY-MM-DD". */
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface FinancialDocumentSummaryDTO {
  id: string;
  status: string;
  displayStatus: string;
  parcels: FinancialParcelSummaryDTO[];
}
