// src/modules/inventory/application/dto/StockMovementDTO.ts

import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { ProductVariantDTO, UserDTO } from "./CommonDTO";
import { InventoryDTO } from "./InventoryDTO";

export interface StockMovementDTO {
  id: string;

  inventoryId: string;

  productVariantId: string;

  type: StockMovementType;

  origin: StockMovementOrigin;

  quantity: number;

  originId?: string | null;

  userId: string;

  notes?: string | null;

  createdAt: Date;
}

export interface StockMovementWithExtendsDTO extends StockMovementDTO {
  productVariant: ProductVariantDTO;
  user: UserDTO;
  inventory: InventoryDTO;
}
