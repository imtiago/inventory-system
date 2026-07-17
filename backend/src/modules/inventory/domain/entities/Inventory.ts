import { v4 as uuid } from "uuid";

// backend/src/modules/inventory/domain/entities/Inventory.ts
export class Inventory {
  private _id: string;
  private _productVariantId: string;
  private _quantity: number;
  private _reservedQuantity: number;
  private _minimumStock: number;
  private _createdAt: Date;

  constructor(props: {
    id?: string;
    productVariantId: string;
    quantity?: number;
    reservedQuantity?: number;
    minimumStock?: number;
    createdAt?: Date;
  }) {
    this._id = props.id ?? uuid();
    this._productVariantId = props.productVariantId;
    this._quantity = props.quantity ?? 0;
    this._reservedQuantity = props.reservedQuantity ?? 0;
    this._minimumStock = props.minimumStock ?? 0;
    this._createdAt = props.createdAt ?? new Date();
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

  get reservedQuantity(): number {
    return this._reservedQuantity;
  }

  get minimumStock(): number {
    return this._minimumStock;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get availableQuantity(): number {
    return this._quantity - this._reservedQuantity;
  }

  increase(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    this._quantity += quantity;
  }

  decrease(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    if (this.availableQuantity < quantity) {
      throw new Error("Insufficient available stock.");
    }

    this._quantity -= quantity;
  }

  reserve(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    if (this.availableQuantity < quantity) {
      throw new Error("Insufficient available stock.");
    }

    this._reservedQuantity += quantity;
  }

  releaseReservation(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    if (this._reservedQuantity < quantity) {
      throw new Error("Reserved quantity is insufficient.");
    }

    this._reservedQuantity -= quantity;
  }

  changeMinimumStock(quantity: number): void {
    if (quantity < 0) {
      throw new Error("Minimum stock cannot be negative.");
    }

    this._minimumStock = quantity;
  }

  isBelowMinimumStock(): boolean {
    return this.availableQuantity < this._minimumStock;
  }
}
