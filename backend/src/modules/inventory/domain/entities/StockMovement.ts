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

  previousQuantity: number;
  currentQuantity: number;

  originId?: string | null;

  userId: string;

  notes?: string;

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
      notes: props.notes ?? "",
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

  get notes() {
    return this.props.notes;
  }

  private validate() {
    if (this.props.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    // switch (this.props.type) {
    //   case StockMovementType.IN:
    //     if (
    //       this.props.currentQuantity !==
    //       this.props.previousQuantity + this.props.quantity
    //     ) {
    //       throw new Error("Invalid IN movement.");
    //     }
    //     break;

    //   case StockMovementType.OUT:
    //     if (
    //       this.props.currentQuantity !==
    //       this.props.previousQuantity - this.props.quantity
    //     ) {
    //       throw new Error("Invalid OUT movement.");
    //     }
    //     break;

    //   case StockMovementType.ADJUSTMENT:
    //     // qualquer valor é permitido
    //     break;
    // }
  }
}
