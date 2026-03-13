// backend/src/modules/inventory/domain/entities/StockMovement.ts
export type StockMovementType = "ENTRY" | "EXIT";

export interface StockMovementProps {
  id: string;
  productVariantId: string;
  type: StockMovementType;
  quantity: number;
  createdAt: Date;
}

export class StockMovement {
  id: string;
  productVariantId: string;
  type: StockMovementType;
  quantity: number;
  createdAt: Date;

  constructor(props: StockMovementProps) {
    this.id = props.id;
    this.productVariantId = props.productVariantId;
    this.type = props.type;
    this.quantity = props.quantity;
    this.createdAt = props.createdAt;
  }
}
