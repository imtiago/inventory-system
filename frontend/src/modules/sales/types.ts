export type SaleStatus = 'COMPLETED' | 'PENDING' | 'CANCELLED';

export interface ISaleItem {
  id: string;
  productVariantId: string;
  quantity: number;
  totalPrice: number | null;
}

export interface ISale {
  id: string;
  createdAt: string;
  totalAmount: string;
  status: SaleStatus;
  customer: {
    id: string;
    name: string;
  };
  items: ISaleItem[];
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
  quantity: number;
  unitPrice: number;
}

export interface ICreateSaleDTO {
  sellerId: string;
  customerId: string;
  items: {
    productVariantId: string;
    quantity: number;
  }[];
}
