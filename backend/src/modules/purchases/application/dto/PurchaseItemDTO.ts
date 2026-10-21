export interface PurchaseItemDTO {
  id: string;

  productVariantId: string;

  productName: string;

  barcode?: string;

  quantity: number;

  unitPrice: number;

  total: number;
}
