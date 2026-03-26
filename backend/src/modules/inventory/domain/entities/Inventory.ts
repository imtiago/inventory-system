import { v4 as uuid } from "uuid";

// backend/src/modules/inventory/domain/entities/Inventory.ts
export class Inventory {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  minimumStock: number;
  createdAt: Date;

  constructor(props: {
    id?: string;
    productVariantId: string;
    quantity?: number;
    reservedQuantity?: number;
    minimumStock?: number;
    createdAt?: Date;
  }) {
    this.id = props.id ?? uuid();
    this.productVariantId = props.productVariantId;
    this.quantity = props.quantity ?? 0;
    this.reservedQuantity = props.reservedQuantity ?? 0;
    this.minimumStock = props.minimumStock ?? 0;
    this.createdAt = props.createdAt ?? new Date();
  }
}
