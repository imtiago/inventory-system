import { roundCost } from "@shared/domain/money";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { BusinessRuleError, ErrorCodes } from "@shared/domain/errors";

export interface InventoryReceiveProps {
  quantity: number;
  unitCost: number;
}

interface InventoryProps {
  id?: string;
  productVariantId: string;

  quantity?: number;
  reservedQuantity?: number;
  minimumStock?: number;
  averageCost?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export class Inventory extends BaseEntity {
  private _productVariantId: string;
  private _quantity: number;
  private _reservedQuantity: number;
  private _minimumStock: number;
  private _averageCost: number;
  private _updatedAt: Date;

  constructor(props: InventoryProps) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this._productVariantId = props.productVariantId;
    this._quantity = props.quantity ?? 0;
    this._reservedQuantity = props.reservedQuantity ?? 0;
    this._minimumStock = props.minimumStock ?? 0;
    this._averageCost = props.averageCost ?? 0;
    this._updatedAt = props.updatedAt ?? new Date();

    this.validate();
  }

  get productVariantId() {
    return this._productVariantId;
  }

  get quantity() {
    return this._quantity;
  }

  get reservedQuantity() {
    return this._reservedQuantity;
  }

  get availableQuantity() {
    return this._quantity - this._reservedQuantity;
  }

  get averageCost() {
    return this._averageCost;
  }

  get minimumStock() {
    return this._minimumStock;
  }

  get updatedAt() {
    return this._updatedAt;
  }

  public hasAvailableStock(quantity: number): boolean {
    return this.availableQuantity >= quantity;
  }

  public isBelowMinimumStock(): boolean {
    return this.availableQuantity <= this._minimumStock;
  }

  public receive(props: InventoryReceiveProps): void {
    this.validateQuantity(props.quantity);

    if (props.unitCost < 0) {
      throw new BusinessRuleError("O custo unitário não pode ser negativo.", ErrorCodes.INVALID_UNIT_COST);
    }

    const currentValue = this._quantity * this._averageCost;
    const receivedValue = props.quantity * props.unitCost;

    const newQuantity = this._quantity + props.quantity;

    this._averageCost =
      newQuantity === 0 ? 0 : roundCost((currentValue + receivedValue) / newQuantity);

    this._quantity = newQuantity;

    this.touch();
  }

  public dispatch(quantity: number): void {
    this.validateQuantity(quantity);

    if (!this.hasAvailableStock(quantity)) {
      throw new BusinessRuleError("Estoque disponível insuficiente.", ErrorCodes.INSUFFICIENT_STOCK);
    }

    this._quantity -= quantity;

    this.touch();
  }

  /**
   * Estorno de uma entrada (importação de NF-e desfeita): retira `quantity` do saldo, que precisa
   * estar disponível (não reservado), e grava o custo médio recalculado pelo chamador.
   */
  public revertReceipt(quantity: number, averageCost: number): void {
    this.validateQuantity(quantity);

    if (!this.hasAvailableStock(quantity)) {
      throw new BusinessRuleError("Estoque disponível insuficiente.", ErrorCodes.INSUFFICIENT_STOCK);
    }
    if (averageCost < 0) {
      throw new BusinessRuleError("O custo médio não pode ser negativo.", ErrorCodes.INVALID_UNIT_COST);
    }

    this._quantity -= quantity;
    this._averageCost = averageCost;

    this.touch();
  }

  public reserve(quantity: number): void {
    this.validateQuantity(quantity);

    if (!this.hasAvailableStock(quantity)) {
      throw new BusinessRuleError("Estoque disponível insuficiente.", ErrorCodes.INSUFFICIENT_STOCK);
    }

    this._reservedQuantity += quantity;

    this.touch();
  }

  public release(quantity: number): void {
    this.validateQuantity(quantity);

    if (quantity > this._reservedQuantity) {
      throw new BusinessRuleError("Quantidade reservada insuficiente.", ErrorCodes.INSUFFICIENT_STOCK);
    }

    this._reservedQuantity -= quantity;

    this.touch();
  }

  public adjust(quantity: number): void {
    if (quantity < 0) {
      throw new BusinessRuleError("A quantidade não pode ser negativa.", ErrorCodes.INVALID_QUANTITY);
    }

    this._quantity = quantity;

    if (this._reservedQuantity > quantity) {
      this._reservedQuantity = quantity;
    }

    this.touch();
  }

  private validate() {
    if (this._quantity < 0) {
      throw new BusinessRuleError("A quantidade em estoque não pode ser negativa.", ErrorCodes.INVALID_QUANTITY);
    }

    if (this._reservedQuantity < 0) {
      throw new BusinessRuleError("A quantidade reservada não pode ser negativa.", ErrorCodes.INVALID_QUANTITY);
    }

    if (this._reservedQuantity > this._quantity) {
      throw new BusinessRuleError("A quantidade reservada não pode exceder o estoque.", ErrorCodes.INVALID_QUANTITY);
    }

    if (this._averageCost < 0) {
      throw new BusinessRuleError("O custo médio não pode ser negativo.", ErrorCodes.INVALID_UNIT_COST);
    }
  }

  private validateQuantity(quantity: number) {
    if (quantity <= 0) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }
  }

  private touch() {
    this._updatedAt = new Date();
  }
}
