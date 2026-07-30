import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { StockMovementOrigin } from "../enums/StockMovementOrigin";
import { StockMovementType } from "../enums/StockMovementType";

interface StockMovementProps {
  id?: string;

  inventoryId: string;

  productVariantId: string;

  type: StockMovementType;

  origin: StockMovementOrigin;

  quantity: number;

  originId?: string | null;

  userId: string;

  notes?: string | null;

  createdAt?: Date;
}

export class StockMovement extends BaseEntity {
  private _inventoryId: string;

  private _productVariantId: string;

  private _type: StockMovementType;

  private _origin: StockMovementOrigin;

  private _quantity: number;

  private _originId?: string | null;

  private _userId: string;

  private _notes?: string | null;

  constructor(props: StockMovementProps) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    if (props.quantity <= 0) {
      throw new Error("Stock movement quantity must be greater than zero");
    }

    this._inventoryId = props.inventoryId;

    this._productVariantId = props.productVariantId;

    this._type = props.type;

    this._origin = props.origin;

    this._quantity = props.quantity;

    this._originId = props.originId ?? null;

    this._userId = props.userId;

    this._notes = props.notes ?? null;
  }

  public get inventoryId() {
    return this._inventoryId;
  }

  public get productVariantId() {
    return this._productVariantId;
  }

  public get type() {
    return this._type;
  }

  public get origin() {
    return this._origin;
  }

  public get quantity() {
    return this._quantity;
  }

  public get originId() {
    return this._originId;
  }

  public get userId() {
    return this._userId;
  }

  public get notes() {
    return this._notes;
  }
}
