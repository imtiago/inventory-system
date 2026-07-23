// src/modules/sales/domain/entities/SaleItem.ts

import { v4 as uuid } from "uuid";

export class SaleItem {
  private _id: string;

  // referência
  private _variantId: string;

  // snapshot histórico
  private _variantName: string;

  private _variantCode: string;

  private _barcode: string | null;

  // dados da venda
  private _quantity: number;

  private _unitPrice: number;

  constructor(props: {
    id?: string;

    variantId: string;

    variantName: string;
    variantCode: string;
    barcode?: string | null;

    quantity: number;
    unitPrice: number;
  }) {
    if (!props.variantId.trim()) {
      throw new Error("Variant id is required.");
    }

    if (!props.variantName.trim()) {
      throw new Error("Variant name is required.");
    }

    if (props.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    if (props.unitPrice < 0) {
      throw new Error("Unit price cannot be negative.");
    }

    this._id = props.id ?? uuid();

    this._variantId = props.variantId;

    this._variantName = props.variantName;

    this._variantCode = props.variantCode;

    this._barcode = props.barcode ?? null;

    this._quantity = props.quantity;

    this._unitPrice = props.unitPrice;
  }

  get id(): string {
    return this._id;
  }

  get variantId(): string {
    return this._variantId;
  }

  get variantName(): string {
    return this._variantName;
  }

  get variantCode(): string {
    return this._variantCode;
  }

  get barcode(): string | null {
    return this._barcode;
  }

  get quantity(): number {
    return this._quantity;
  }

  get unitPrice(): number {
    return this._unitPrice;
  }

  get total(): number {
    return this._quantity * this._unitPrice;
  }
}
