export interface PurchaseDTO {
  id: string;

  supplierId: string;

  supplierName: string;

  purchaseDate: Date;

  status: string;

  total: number;
}

export interface ICancelPurchaseInput {
  productId: string;
  name: string;
  // sku: string;
  barcode?: string;
}
