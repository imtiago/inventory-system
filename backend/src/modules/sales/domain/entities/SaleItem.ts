// src/modules/sales/domain/entities/SaleItem.ts
export class SaleItem {
  productVariantId: string;
  quantity: number;
  price: number;

  constructor(props: {
    productVariantId: string;
    quantity?: number;
    price?: number;
  }) {
    this.productVariantId = props.productVariantId;
    this.quantity = props.quantity ?? 0;
    this.price = props.price ?? 0;
  }

  totalPrice(): number {
    return this.quantity * this.price;
  }
}
