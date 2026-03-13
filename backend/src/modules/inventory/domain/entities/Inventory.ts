// backend/src/modules/inventory/domain/entities/Inventory.ts
export interface InventoryProps {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  minimumStock: number;
  createdAt: Date;
}

export class Inventory {
  id: string;
  productVariantId: string;
  quantity: number;
  reservedQuantity: number;
  minimumStock: number;
  createdAt: Date;

  constructor(props: InventoryProps) {
    this.id = props.id;
    this.productVariantId = props.productVariantId;
    this.quantity = props.quantity;
    this.reservedQuantity = props.reservedQuantity;
    this.minimumStock = props.minimumStock;
    this.createdAt = props.createdAt;
  }
}
