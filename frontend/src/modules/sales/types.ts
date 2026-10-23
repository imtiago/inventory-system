export type SaleStatus = 'COMPLETED' | 'PENDING' | 'CANCELED';

/** GET /sales list row (SaleListItemDTO). */
export interface ISale {
  id: string;
  status: SaleStatus;
  totalAmount: number;
  createdAt: string;
  customer: { id: string; name: string };
  itemsCount: number;
}

export interface ISalesResponse {
  data: ISale[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ISaleDraftItem {
  productVariantId: string;
  productName: string;
  productCode: string;
  /** null while the field is empty (validated on submit). */
  quantity: number | null;
  /** R$ unit price from the variant (salePrice). 0 means the variant has no price. */
  unitPrice: number;
}

export interface ISalePaymentTerms {
  installments: number;
  /** "YYYY-MM-DD"; required by the backend when installments > 1. */
  firstDueDate?: string;
}

export interface ICreateSaleDTO {
  customerId: string;
  items: {
    productVariantId: string;
    quantity: number;
  }[];
  paymentTerms: ISalePaymentTerms;
}

export interface ISaleParcel {
  id: string;
  amount: number;
  /** Date-only "YYYY-MM-DD". */
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface ISaleDetail {
  id: string;
  status: SaleStatus;
  totalAmount: number;
  createdAt: string;
  customer: { id: string; name: string };
  seller: { id: string; name: string } | null;
  items: {
    id: string;
    productVariant: { id: string; name: string; code: string; barcode: string | null };
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  receivable: { id: string; status: string; parcels: ISaleParcel[] } | null;
}
