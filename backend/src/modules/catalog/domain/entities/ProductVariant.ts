import { v4 as uuid } from "uuid";

export class ProductVariant {
  private _id: string;
  private _productId: string;
  private _code: string;
  private _name: string;
  private _barcode: string | null;
  private _createdAt: Date;

  constructor(props: {
    id?: string;
    productId: string;
    code: string;
    name?: string;
    barcode?: string | null;
    createdAt?: Date;
  }) {
    if (!props.productId.trim()) {
      throw new Error("Product id is required.");
    }

    if (!props.code.trim()) {
      throw new Error("Variant code is required.");
    }

    if (props.name !== undefined && !props.name.trim()) {
      throw new Error("Variant name cannot be empty.");
    }

    this._id = props.id ?? uuid();
    this._productId = props.productId;
    this._code = props.code;
    this._name = props.name ?? "Padrão";
    this._barcode = props.barcode ?? null;
    this._createdAt = props.createdAt ?? new Date();
  }

  get id(): string {
    return this._id;
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

  get createdAt(): Date {
    return this._createdAt;
  }

  rename(name: string): void {
    this._name = name;
  }

  changeBarcode(barcode: string | null): void {
    this._barcode = barcode;
  }
}
