import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export interface InventoryBoxStockProps {
  id?: string;
  inventoryLotId: string;
  boxId: string;
  quantity: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class InventoryBoxStock extends BaseEntity {
  private _inventoryLotId: string;
  private _boxId: string;
  private _quantity: number;
  private _updatedAt: Date;

  constructor(private readonly props: InventoryBoxStockProps) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this._inventoryLotId = props.inventoryLotId;
    this._boxId = props.boxId;
    this._quantity = props.quantity;
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get inventoryLotId(): string {
    return this._inventoryLotId;
  }

  get boxId(): string {
    return this._boxId;
  }

  get quantity(): number {
    return this._quantity;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
