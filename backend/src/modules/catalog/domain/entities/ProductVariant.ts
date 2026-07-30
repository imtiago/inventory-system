// src/modules/catalog/domain/entities/ProductVariant.ts

import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export class ProductVariant extends BaseEntity {
  private _productId: string;

  private _code: string;

  private _name: string;

  private _barcode: string | null;

  private _salePrice: number;

  constructor(props: {
    id?: string;
    productId: string;
    code: string;
    name?: string;
    barcode?: string | null;
    salePrice?: number;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    if (!props.productId.trim()) {
      throw new Error("Product id is required.");
    }

    if (!props.code.trim()) {
      throw new Error("Variant code is required.");
    }

    if (props.name !== undefined && !props.name.trim()) {
      throw new Error("Variant name cannot be empty.");
    }

    if (props.salePrice !== undefined && props.salePrice < 0) {
      throw new Error("Sale price cannot be negative.");
    }

    this._productId = props.productId;

    this._code = props.code;

    this._name = props.name ?? "Padrão";

    this._barcode = props.barcode ?? null;

    this._salePrice = props.salePrice ?? 0;
  }

  get productId(): string {
    return this._productId;
  }

  get code(): string {
    return this._code;
  }

  get name(): string {
    return this._name;
  }

  get barcode(): string | null {
    return this._barcode;
  }

  get salePrice(): number {
    return this._salePrice;
  }

  rename(name: string): void {
    if (!name.trim()) {
      throw new Error("Variant name cannot be empty.");
    }

    this._name = name;
  }

  changeBarcode(barcode: string | null): void {
    this._barcode = barcode;
  }

  changeSalePrice(price: number): void {
    if (price < 0) {
      throw new Error("Sale price cannot be negative.");
    }

    this._salePrice = price;
  }
}
