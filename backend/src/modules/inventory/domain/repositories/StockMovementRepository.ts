// domain/repositories/StockMovementRepository.ts

import { StockMovement } from "../entities/StockMovement";

export interface StockMovementRepository {
  create(movement: StockMovement): Promise<void>;

  findByProductVariantId(productVariantId: string): Promise<StockMovement[]>;
}
