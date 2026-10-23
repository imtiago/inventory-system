export interface SaleItemDTO {
  id: string;
  productVariant: {
    id: string;
    name: string;
    code: string;
    barcode: string | null;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
