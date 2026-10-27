import type { Paginated } from '@/shared/types/pagination';

export type PurchaseStatus = 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELED';

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  PENDING: 'Pendente',
  PARTIALLY_RECEIVED: 'Recebido parcialmente',
  RECEIVED: 'Recebido',
  CANCELED: 'Cancelado',
};

/** GET /purchases list row (PurchaseListItemDTO). Money in reais, dates "YYYY-MM-DD". */
export interface IPurchaseListItem {
  id: string;
  code: string;
  status: PurchaseStatus;
  supplier: { id: string; name: string };
  purchaseDate: string;
  totalAmount: number;
  itemsCount: number;
  receivedPercent: number;
  createdAt: string;
}

export type PurchaseListResponse = Paginated<IPurchaseListItem>;

export interface IPurchaseFilters {
  status?: PurchaseStatus;
  supplierId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface IPurchaseItem {
  id: string;
  productVariant: { id: string; name: string; code: string; barcode: string | null };
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  discount: number;
  freight: number;
  tax: number;
  total: number;
  unitCost: number;
}

export interface IPurchaseParcel {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface IPurchaseDetail {
  id: string;
  code: string;
  status: PurchaseStatus;
  supplier: { id: string; name: string };
  purchaseDate: string;
  notes: string | null;
  totalAmount: number;
  /** Frete e outras despesas do pedido inteiro (R$); já rateadas nos itens. */
  extraCosts: number;
  createdAt: string;
  items: IPurchaseItem[];
  payable: { id: string; status: string; displayStatus: string; parcels: IPurchaseParcel[] } | null;
}

export interface ICreatePurchaseDTO {
  supplierId: string;
  purchaseDate: string;
  notes?: string;
  /** Frete e outras despesas do pedido inteiro (R$); omitido quando zero. */
  extraCosts?: number;
  items: {
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    freight: number;
    tax: number;
  }[];
  paymentTerms: { installments: number; firstDueDate?: string };
}

export interface IReceivePurchaseDTO {
  items: {
    purchaseItemId: string;
    quantity: number;
    batchNumber?: string;
    manufacturingDate?: string;
    expirationDate?: string;
  }[];
}
