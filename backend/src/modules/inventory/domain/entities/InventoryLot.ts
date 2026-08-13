import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { InventoryLotSource } from "../enums/InventoryLotSource";

interface InventoryLotProps {
  id?: string;

  inventoryId: string;
  productVariantId: string;

  sourceType: InventoryLotSource;
  sourceId?: string | null;

  quantity: number;
  availableQuantity?: number;

  unitCost: number;

  batchNumber?: string | null;

  manufacturingDate?: Date | null;
  expirationDate?: Date | null;

  createdAt?: Date;
}

export class InventoryLot extends BaseEntity {
  private props: InventoryLotProps;

  constructor(props: InventoryLotProps) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this.props = {
      ...props,
      availableQuantity: props.availableQuantity ?? props.quantity,
    };

    this.validate();
  }

  get inventoryId() {
    return this.props.inventoryId;
  }

  get productVariantId() {
    return this.props.productVariantId;
  }

  get quantity() {
    return this.props.quantity;
  }

  get availableQuantity() {
    return this.props.availableQuantity!;
  }

  get unitCost() {
    return this.props.unitCost;
  }

  get sourceType() {
    return this.props.sourceType;
  }

  get sourceId() {
    return this.props.sourceId;
  }

  get batchNumber() {
    return this.props.batchNumber;
  }

  get expirationDate() {
    return this.props.expirationDate;
  }

  get manufacturingDate() {
    return this.props.manufacturingDate;
  }

  get consumedQuantity() {
    return this.props.quantity - this.availableQuantity;
  }
  public addQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    this.props.quantity += quantity;
    this.props.availableQuantity! += quantity;
  }

  public consume(quantity: number) {
    if (quantity <= 0) {
      throw new Error("Invalid quantity.");
    }

    if (quantity > this.availableQuantity) {
      throw new Error("Insufficient quantity.");
    }

    this.props.availableQuantity! -= quantity;
  }

  public restore(quantity: number) {
    if (quantity <= 0) {
      throw new Error("Invalid quantity.");
    }

    if (this.availableQuantity + quantity > this.props.quantity) {
      throw new Error("Invalid restore quantity.");
    }

    this.props.availableQuantity! += quantity;
  }

  public isExpired(reference = new Date()) {
    if (!this.props.expirationDate) {
      return false;
    }

    return this.props.expirationDate < reference;
  }

  public isEmpty() {
    return this.availableQuantity === 0;
  }

  private validate() {
    if (this.props.quantity <= 0) {
      throw new Error("Invalid quantity.");
    }

    if (this.availableQuantity < 0) {
      throw new Error("Invalid available quantity.");
    }

    if (this.availableQuantity > this.props.quantity) {
      throw new Error("Available quantity exceeds total quantity.");
    }

    if (this.props.unitCost < 0) {
      throw new Error("Invalid unit cost.");
    }
  }

  public receive(quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    this.props.quantity += quantity;
    this.props.availableQuantity! += quantity;
  }
}
