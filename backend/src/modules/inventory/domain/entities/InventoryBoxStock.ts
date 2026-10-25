import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { BusinessRuleError, ErrorCodes } from "@shared/domain/errors";

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

    this.validate();
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

  public addQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    this._quantity += quantity;
    this.touch();
  }

  public removeQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    if (quantity > this._quantity) {
      throw new BusinessRuleError("Quantidade maior que a alocada nesta caixa.", ErrorCodes.BOX_STOCK_INSUFFICIENT);
    }

    this._quantity -= quantity;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private validate(): void {
    if (this._quantity < 0) {
      throw new BusinessRuleError("A quantidade não pode ser negativa.", ErrorCodes.INVALID_QUANTITY);
    }
  }
}
