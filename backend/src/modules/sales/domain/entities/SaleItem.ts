// src/modules/sales/domain/entities/SaleItem.ts

import { v4 as uuid } from "uuid";

export class SaleItem {
  private _id: string;
  private _productVariantId: string;
  private _quantity: number;
  private _price: number;

  constructor(props: {
    id?: string;
    productVariantId: string;
    quantity?: number;
    price?: number;
  }) {
    this._id = props.id ?? uuid();

    this._productVariantId = props.productVariantId;

    this._quantity = props.quantity ?? 0;

    this._price = props.price ?? 0;

    this.validate();
  }

  private validate(): void {
    if (this._quantity <= 0) {
      throw new Error("Sale item quantity must be greater than zero.");
    }

    if (this._price < 0) {
      throw new Error("Sale item price cannot be negative.");
    }
  }

  get id(): string {
    return this._id;
  }

  get productVariantId(): string {
    return this._productVariantId;
  }

  get quantity(): number {
    return this._quantity;
  }

  get price(): number {
    return this._price;
  }

  get totalPrice(): number {
    return this._quantity * this._price;
  }

  changeQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Sale item quantity must be greater than zero.");
    }

    this._quantity = quantity;
  }

  changePrice(price: number): void {
    if (price < 0) {
      throw new Error("Sale item price cannot be negative.");
    }

    this._price = price;
  }
}
