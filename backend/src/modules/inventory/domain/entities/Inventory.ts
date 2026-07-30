import { BaseEntity } from "@shared/domain/entities/BaseEntity";

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

  private validate(): void {
    if (this._quantity < 0) {
      throw new Error("Inventory quantity cannot be negative");
    }

    if (this._reservedQuantity < 0) {
      throw new Error("Reserved quantity cannot be negative");
    }

    if (this._reservedQuantity > this._quantity) {
      throw new Error("Reserved quantity cannot exceed stock");
    }
  }

  public get productVariantId() {
    return this._productVariantId;
  }

  public get quantity() {
    return this._quantity;
  }

  public get reservedQuantity() {
    return this._reservedQuantity;
  }

  public get minimumStock() {
    return this._minimumStock;
  }

  public get averageCost() {
    return this._averageCost;
  }

  public get availableQuantity() {
    return this._quantity - this._reservedQuantity;
  }

  public get updatedAt() {
    return this._updatedAt;
  }

  /**
   * Entrada de estoque
   */
  public increase(quantity: number): void {
    this.validateQuantity(quantity);

    this._quantity += quantity;

    this.touch();
  }

  /**
   * Saída de estoque
   */
  public decrease(quantity: number): void {
    this.validateQuantity(quantity);

    if (quantity > this.availableQuantity) {
      throw new Error("Insufficient available stock");
    }

    this._quantity -= quantity;

    this.touch();
  }

  /**
   * Reserva estoque para venda
   */
  public reserve(quantity: number): void {
    this.validateQuantity(quantity);

    if (quantity > this.availableQuantity) {
      throw new Error("Insufficient stock to reserve");
    }

    this._reservedQuantity += quantity;

    this.touch();
  }

  /**
   * Libera uma reserva
   */
  public release(quantity: number): void {
    this.validateQuantity(quantity);

    if (quantity > this._reservedQuantity) {
      throw new Error("Invalid reserved quantity");
    }

    this._reservedQuantity -= quantity;

    this.touch();
  }

  /**
   * Ajuste manual de estoque
   */
  public adjust(quantity: number): void {
    if (quantity < 0) {
      throw new Error("Invalid inventory adjustment");
    }

    this._quantity = quantity;

    if (this._reservedQuantity > quantity) {
      this._reservedQuantity = quantity;
    }

    this.touch();
  }

  public updateAverageCost(cost: number) {
    if (cost < 0) {
      throw new Error("Invalid average cost");
    }

    this._averageCost = cost;

    this.touch();
  }

  private validateQuantity(quantity: number) {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero");
    }
  }

  private touch() {
    this._updatedAt = new Date();
  }
}
