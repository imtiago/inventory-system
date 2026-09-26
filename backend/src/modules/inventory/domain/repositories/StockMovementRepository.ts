import { Prisma } from "@prisma/client";
import { StockMovement } from "../entities/StockMovement";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";

export interface IStockMovementRepository extends ICrudRepository<StockMovement> {
  findByProductVariantId(
    productVariantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StockMovement[]>;
}
