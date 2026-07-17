// src/modules/nfe-import/domain/entities/NfeItem.ts

export class NfeItem {
  private _code: string;
  private _name: string;
  private _quantity: number;
  private _unit: string;
  private _price: number;

  constructor(props: {
    code: string;
    name: string;
    quantity?: number;
    unit: string;
    price?: number;
  }) {
    if (props.quantity !== undefined && props.quantity < 0) {
      throw new Error("Quantity cannot be negative.");
    }

    if (props.price !== undefined && props.price < 0) {
      throw new Error("Price cannot be negative.");
    }

    this._code = props.code;
    this._name = props.name;
    this._quantity = props.quantity ?? 0;
    this._unit = props.unit;
    this._price = props.price ?? 0;
  }

  get code(): string {
    return this._code;
  }

  get name(): string {
    return this._name;
  }

  get quantity(): number {
    return this._quantity;
  }

  get unit(): string {
    return this._unit;
  }

  get price(): number {
    return this._price;
  }

  updateQuantity(quantity: number): void {
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative.");
    }

    this._quantity = quantity;
  }

  updatePrice(price: number): void {
    if (price < 0) {
      throw new Error("Price cannot be negative.");
    }

    this._price = price;
  }
}
