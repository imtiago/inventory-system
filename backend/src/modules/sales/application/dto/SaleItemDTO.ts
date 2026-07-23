export interface SaleItemDTO {
  id: string;

  productVariant: {
    id: string;
    name: string;
    barcode: string;
  };

  quantity: number;

  unitPrice: number;

  totalPrice: number;
}
