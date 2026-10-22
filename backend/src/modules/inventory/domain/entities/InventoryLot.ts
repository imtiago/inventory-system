import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { InventoryLotSource } from "../enums/InventoryLotSource";

interface InventoryLotProps {
  id?: string;

  inventoryId: string;
  productVariantId: string;

  sourceType: InventoryLotSource;
  sourceId?: string | null;

  initialQuantity: number;
  remainingQuantity?: number;

  unitCost: number;

  batchNumber?: string | null;

  manufacturingDate?: Date | null;
  expirationDate?: Date | null;

  createdAt?: Date;
}

export class InventoryLot extends BaseEntity {
  private props: InventoryLotProps & { remainingQuantity: number };

  constructor(props: InventoryLotProps) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this.props = {
      ...props,
      remainingQuantity: props.remainingQuantity ?? props.initialQuantity,
    };

    this.validate();
  }

  get inventoryId() {
    return this.props.inventoryId;
  }

  get productVariantId() {
    return this.props.productVariantId;
  }

  get sourceType() {
    return this.props.sourceType;
  }

  get sourceId() {
    return this.props.sourceId;
  }

  get initialQuantity() {
    return this.props.initialQuantity;
  }

  get remainingQuantity() {
    return this.props.remainingQuantity;
  }

  get unitCost() {
    return this.props.unitCost;
  }

  get batchNumber() {
    return this.props.batchNumber;
  }

  get manufacturingDate() {
    return this.props.manufacturingDate;
  }

  get expirationDate() {
    return this.props.expirationDate;
  }

  public receive(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    this.props.initialQuantity += quantity;
    this.props.remainingQuantity += quantity;
  }

  public consume(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Invalid quantity.");
    }

    if (quantity > this.props.remainingQuantity) {
      throw new Error("Insufficient quantity.");
    }

    this.props.remainingQuantity -= quantity;
  }

  public restore(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Invalid quantity.");
    }

    if (this.props.remainingQuantity + quantity > this.props.initialQuantity) {
      throw new Error("Invalid restore quantity.");
    }

    this.props.remainingQuantity += quantity;
  }

  public isEmpty(): boolean {
    return this.props.remainingQuantity === 0;
  }

  public isExpired(reference = new Date()): boolean {
    if (!this.props.expirationDate) {
      return false;
    }

    return this.props.expirationDate < reference;
  }

  private validate() {
    if (this.props.initialQuantity <= 0) {
      throw new Error("Invalid quantity.");
    }

    if (this.props.remainingQuantity < 0) {
      throw new Error("Invalid remaining quantity.");
    }

    if (this.props.remainingQuantity > this.props.initialQuantity) {
      throw new Error("Remaining quantity exceeds initial quantity.");
    }

    if (this.props.unitCost < 0) {
      throw new Error("Invalid unit cost.");
    }
  }
}
