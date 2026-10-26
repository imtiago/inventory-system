import { StockMovement } from "../entities/StockMovement";
import { StockMovementOrigin } from "../enums/StockMovementOrigin";

/**
 * Kardex só de inserção: sem `update` nem `delete` no contrato (uma movimentação gravada
 * não muda; a correção é uma nova movimentação).
 */
export interface IStockMovementRepository {
  create(entity: StockMovement): Promise<StockMovement>;
  findById(id: string): Promise<StockMovement | null>;
  findByProductVariantId(
    productVariantId: string
  ): Promise<StockMovement[]>;
  /** Movimentações de uma origem (ex.: SALE + id da venda), da mais antiga para a mais nova. */
  findByOrigin(
    origin: StockMovementOrigin,
    originId: string
  ): Promise<StockMovement[]>;
}
