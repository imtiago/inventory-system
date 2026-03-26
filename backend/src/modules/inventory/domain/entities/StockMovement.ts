import { v4 as uuid } from "uuid";
import { StockMovementType } from "@prisma/client";

// backend/src/modules/inventory/domain/entities/StockMovement.ts
export class StockMovement {
  id: string;
  productVariantId: string;
  type: StockMovementType;
  quantity: number;
  createdAt: Date;

  constructor(props: {
    id?: string;
    productVariantId: string;
    type: StockMovementType;
    quantity: number;
    createdAt?: Date;
  }) {
    this.id = props.id ?? uuid();
    this.productVariantId = props.productVariantId;
    this.type = props.type;
    this.quantity = props.quantity;
    this.createdAt = props.createdAt ?? new Date();
  }
}
