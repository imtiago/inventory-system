// Contrato de leitura de contas a receber (spec 3B §4). Valores monetários com
// 2 casas (calculados em centavos); vencimento/pagamento em "YYYY-MM-DD".

export type ReceivableStatusFilter = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELED";

export interface PersonRefDTO {
  id: string;
  name: string;
}

export interface ReceivableListItemDTO {
  id: string;
  status: string;
  displayStatus: string;
  originType: string;
  originId: string;
  customer: PersonRefDTO;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  nextDueDate: string | null;
  parcelsCount: number;
  createdAt: Date;
}

export interface ReceivablePaymentDTO {
  id: string;
  amount: number;
  method: string;
  paymentDate: string;
  reference: string | null;
  createdAt: Date;
  createdBy: PersonRefDTO | null;
  reversedAt: Date | null;
  reversedBy: PersonRefDTO | null;
  reversalReason: string | null;
}

export interface ReceivableParcelDTO {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  payments: ReceivablePaymentDTO[];
}

export interface ReceivableDetailDTO {
  id: string;
  status: string;
  displayStatus: string;
  originType: string;
  originId: string;
  customer: PersonRefDTO;
  createdAt: Date;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  parcels: ReceivableParcelDTO[];
}

export interface ReceivableSummaryDTO {
  /** Saldo a vencer (vencimento ≥ hoje) de documentos não cancelados. */
  openAmount: number;
  /** Saldo vencido (vencimento < hoje) de documentos não cancelados. */
  overdueAmount: number;
  /** Soma dos pagamentos ativos (não estornados). */
  receivedAmount: number;
}

export interface ReceivableListFilters {
  status?: ReceivableStatusFilter;
  customerId?: string;
  dueFrom?: string;
  dueTo?: string;
}

export interface ReceivableListResult {
  data: ReceivableListItemDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: ReceivableSummaryDTO;
}
