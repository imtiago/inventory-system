import { v4 as uuid } from "uuid";
import { StockMovementType } from "../enums/StockMovementType";
import { StockMovementOrigin } from "../enums/StockMovementOrigin ";

export class StockMovement {
  private _id: string;
  private _productVariantId: string;
  private _type: StockMovementType;
  private _origin: StockMovementOrigin;
  private _originId: string;
  private _quantity: number;
  private _notes?: string;
  private userId: string;
  private _createdAt: Date;

  constructor(props: {
    id?: string;
    productVariantId: string;
    type: StockMovementType;
    quantity: number;
    notes?: string;
    createdAt?: Date;
  }) {
    if (props.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    this._id = props.id ?? uuid();
    this._productVariantId = props.productVariantId;
    this._type = props.type;
    this._quantity = props.quantity;
    this._reason = props.reason;
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

  get reason(): string | undefined {
    return this._reason;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  isEntry(): boolean {
    return this._type === StockMovementType.IN;
  }

  isExit(): boolean {
    return this._type === StockMovementType.OUT;
  }

  isAdjustment(): boolean {
    return this._type === StockMovementType.ADJUSTMENT;
  }
}
