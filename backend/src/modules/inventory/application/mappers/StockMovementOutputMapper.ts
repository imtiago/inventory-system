import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";

export interface StockMovementOutputDTO {
  id: string;
  type: StockMovementType;
  origin: StockMovementOrigin;
  quantity: number;
  previousQuantity: number | null;
  currentQuantity: number | null;
  inventoryLotId: string | null;
  averageCost: number | null;
  originId: string | null;
  userId: string | null;
  notes: string | null;
  createdAt: Date;
}

/** Movimentação (entidade) → objeto simples para respostas HTTP de escrita. */
export class StockMovementOutputMapper {
  static toDTO(movement: StockMovement): StockMovementOutputDTO {
    return {
      id: movement.id,
      type: movement.type,
      origin: movement.origin,
      quantity: movement.quantity,
      previousQuantity: movement.previousQuantity ?? null,
      currentQuantity: movement.currentQuantity ?? null,
      inventoryLotId: movement.inventoryLotId ?? null,
      averageCost: movement.averageCost ?? null,
      originId: movement.originId ?? null,
      userId: movement.userId ?? null,
      notes: movement.notes ?? null,
      createdAt: movement.createdAt,
    };
  }
}
