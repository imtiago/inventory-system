export type ReceivableStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELED';

export interface IReceivableListItem {
  id: string;
  status: ReceivableStatus;
  displayStatus: ReceivableStatus;
  originType: string;
  originId: string;
  customer: { id: string; name: string };
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  nextDueDate: string | null;
  parcelsCount: number;
  createdAt: string;
}

export interface IReceivableSummary {
  openAmount: number;
  overdueAmount: number;
  receivedAmount: number;
}

export interface IReceivablesResponse {
  data: IReceivableListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: IReceivableSummary;
}

export interface IReceivableFilters {
  status?: ReceivableStatus;
  customerId?: string;
  dueFrom?: string;
  dueTo?: string;
}

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  OPEN: 'A vencer',
  PARTIALLY_PAID: 'Parcialmente paga',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELED: 'Cancelada',
};

export type PaymentMethod = 'CASH' | 'PIX' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  BANK_TRANSFER: 'Transferência',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BOLETO: 'Boleto',
};

export interface IReceivablePayment {
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

export interface IReceivableParcel {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: ReceivableStatus;
  payments: IReceivablePayment[];
}

export interface IReceivableDetail {
  id: string;
  status: ReceivableStatus;
  displayStatus: ReceivableStatus;
  originType: string;
  originId: string;
  customer: { id: string; name: string };
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  parcels: IReceivableParcel[];
}

export interface IRegisterPaymentInput {
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
}
