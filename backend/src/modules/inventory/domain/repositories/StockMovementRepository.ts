// domain/repositories/StockMovementRepository.ts

import { Prisma } from "@prisma/client";
import { StockMovement } from "../entities/StockMovement";

export interface StockMovementRepository {
  create(
    movement: StockMovement,
    tx?: Prisma.TransactionClient,
  ): Promise<StockMovement>;

  // findByProductVariantId(productVariantId: string): Promise<StockMovement[]>;
}
