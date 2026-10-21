// domain/entities/PurchaseItem.ts

export interface PurchaseItemProps {
  id?: string;

  productVariantId: string;

  productName: string;

  sku: string;

  barcode?: string;

  quantity: number;

  unitPrice: number;

  discount?: number;

  freight?: number;

  tax?: number;
}

export class PurchaseItem {
  public readonly id?: string;

  public readonly productVariantId: string;

  public readonly productName: string;

  public readonly sku: string;

  public readonly barcode?: string;

  private quantity: number;

  private unitPrice: number;

  private discount: number;

  private freight: number;

  private tax: number;

  constructor(props: PurchaseItemProps) {
    if (props.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    if (props.unitPrice < 0) {
      throw new Error("Unit price cannot be negative.");
    }

    this.id = props.id;
    this.productVariantId = props.productVariantId;
    this.productName = props.productName;
    this.sku = props.sku;
    this.barcode = props.barcode;

    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.discount = props.discount ?? 0;
    this.freight = props.freight ?? 0;
    this.tax = props.tax ?? 0;
  }

  getQuantity(): number {
    return this.quantity;
  }

  getUnitPrice(): number {
    return this.unitPrice;
  }

  getSubtotal(): number {
    return this.quantity * this.unitPrice;
  }

  getTotal(): number {
    return this.getSubtotal() - this.discount + this.freight + this.tax;
  }

  changeQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Invalid quantity.");
    }

    this.quantity = quantity;
  }

  changeUnitPrice(price: number): void {
    if (price < 0) {
      throw new Error("Invalid price.");
    }

    this.unitPrice = price;
  }
}
