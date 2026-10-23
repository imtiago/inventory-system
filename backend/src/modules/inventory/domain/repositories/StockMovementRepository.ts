import { StockMovement } from "../entities/StockMovement";
import { StockMovementOrigin } from "../enums/StockMovementOrigin";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";

export interface IStockMovementRepository extends ICrudRepository<StockMovement> {
  findByProductVariantId(
    productVariantId: string
  ): Promise<StockMovement[]>;
  /** Movimentações de uma origem (ex.: SALE + id da venda), da mais antiga para a mais nova. */
  findByOrigin(
    origin: StockMovementOrigin,
    originId: string
  ): Promise<StockMovement[]>;
}
