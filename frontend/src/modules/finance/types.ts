import { FINANCIAL_STATUS_LABELS } from '@/shared/utils/financialStatus';

export type FinanceStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELED';

export interface IFinanceListItem {
  id: string;
  status: FinanceStatus;
  displayStatus: FinanceStatus;
  originType: string;
  originId: string;
  /** Receivables carry `customer`, payables carry `supplier`; see FINANCE_KINDS[kind].partyKey. */
  customer?: { id: string; name: string };
  supplier?: { id: string; name: string };
  purchaseCode?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  nextDueDate: string | null;
  parcelsCount: number;
  createdAt: string;
}

export interface IFinanceSummary {
  openAmount: number;
  overdueAmount: number;
  /** Receivables report `receivedAmount`, payables `paidAmount`. */
  receivedAmount?: number;
  paidAmount?: number;
}

export interface IFinanceListResponse {
  data: IFinanceListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: IFinanceSummary;
}

export interface IFinanceFilters {
  status?: FinanceStatus;
  customerId?: string;
  supplierId?: string;
  dueFrom?: string;
  dueTo?: string;
  openOnly?: boolean;
}

export const FINANCE_STATUS_LABELS: Record<FinanceStatus, string> = FINANCIAL_STATUS_LABELS as Record<FinanceStatus, string>;

export type PaymentMethod = 'CASH' | 'PIX' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  BANK_TRANSFER: 'Transferência',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BOLETO: 'Boleto',
};

export interface IFinancePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  reversedAt: string | null;
  reversedBy: { id: string; name: string } | null;
  reversalReason: string | null;
}

export interface IFinanceParcel {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: FinanceStatus;
  payments: IFinancePayment[];
}

export interface IFinanceDetail {
  id: string;
  status: FinanceStatus;
  displayStatus: FinanceStatus;
  originType: string;
  originId: string;
  /** Receivables carry `customer`, payables carry `supplier`; see FINANCE_KINDS[kind].partyKey. */
  customer?: { id: string; name: string };
  supplier?: { id: string; name: string };
  purchaseCode?: string;
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  parcels: IFinanceParcel[];
}

export interface IRegisterPaymentInput {
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
}
