import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { StockMovementOrigin } from "../enums/StockMovementOrigin";
import { StockMovementType } from "../enums/StockMovementType";

interface StockMovementProps {
  id?: string;

  inventoryId: string;
  inventoryLotId?: string | null;

  productVariantId: string;

  type: StockMovementType;
  origin: StockMovementOrigin;

  quantity: number;

  previousQuantity?: number | null;
  currentQuantity?: number | null;

  originId?: string | null;

  userId?: string | null;

  notes?: string | null;
  averageCost?: number | null;

  createdAt?: Date;
}

export class StockMovement extends BaseEntity {
  private props: StockMovementProps;

  constructor(props: StockMovementProps) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });

    this.props = {
      ...props,
      inventoryLotId: props.inventoryLotId ?? null,
      originId: props.originId ?? null,
      userId: props.userId ?? null,
      previousQuantity: props.previousQuantity ?? null,
      currentQuantity: props.currentQuantity ?? null,
      averageCost: props.averageCost ?? null,
      notes: props.notes ?? null,
    };

    this.validate();
  }

  get inventoryId() {
    return this.props.inventoryId;
  }

  get inventoryLotId() {
    return this.props.inventoryLotId;
  }

  get productVariantId() {
    return this.props.productVariantId;
  }

  get type() {
    return this.props.type;
  }

  get origin() {
    return this.props.origin;
  }

  get quantity() {
    return this.props.quantity;
  }

  get previousQuantity() {
    return this.props.previousQuantity;
  }

  get currentQuantity() {
    return this.props.currentQuantity;
  }

  get originId() {
    return this.props.originId;
  }

  get userId() {
    return this.props.userId;
  }

  get averageCost() {
    return this.props.averageCost;
  }

  get notes() {
    return this.props.notes;
  }

  private validate() {
    if (this.props.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    const { type, quantity, previousQuantity, currentQuantity } = this.props;

    // Movimentações legadas não têm saldos: só valida a coerência quando ambos existem.
    if (previousQuantity == null || currentQuantity == null) {
      return;
    }

    switch (type) {
      case StockMovementType.IN:
        if (currentQuantity !== previousQuantity + quantity) {
          throw new Error("Invalid IN movement.");
        }
        break;

      case StockMovementType.OUT:
        if (currentQuantity !== previousQuantity - quantity) {
          throw new Error("Invalid OUT movement.");
        }
        break;

      case StockMovementType.RESERVE:
      case StockMovementType.RELEASE:
        if (currentQuantity !== previousQuantity) {
          throw new Error(`Invalid ${type} movement.`);
        }
        break;

      case StockMovementType.ADJUSTMENT:
        if (quantity !== Math.abs(currentQuantity - previousQuantity)) {
          throw new Error("Invalid ADJUSTMENT movement.");
        }
        break;
    }
  }
}
