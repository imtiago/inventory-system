import { v4 as uuid } from "uuid";
export enum StockMovementType {
  IN = "IN",
  OUT = "OUT",
  ADJUSTMENT = "ADJUSTMENT",
  TRANSFER = "TRANSFER",
}

// backend/src/modules/inventory/domain/entities/StockMovement.ts
export class StockMovement {
  private _id: string;
  private _productVariantId: string;
  private _type: StockMovementType;
  private _quantity: number;
  private _createdAt: Date;

  constructor(props: {
    id?: string;
    productVariantId: string;
    type: StockMovementType;
    quantity: number;
    createdAt?: Date;
  }) {
    if (props.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    this._id = props.id ?? uuid();
    this._productVariantId = props.productVariantId;
    this._type = props.type;
    this._quantity = props.quantity;
    this._createdAt = props.createdAt ?? new Date();
  }

  get id(): string {
    return this._id;
  }

  get productVariantId(): string {
    return this._productVariantId;
  }

  get type(): StockMovementType {
    return this._type;
  }

  get quantity(): number {
    return this._quantity;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
