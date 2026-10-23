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
