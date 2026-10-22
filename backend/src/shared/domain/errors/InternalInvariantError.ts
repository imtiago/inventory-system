/**
 * Violação de invariante interna (bug ou dado inconsistente), nunca causada
 * diretamente pela entrada do cliente. Propositalmente NÃO é um DomainError:
 * o handler central a trata como erro desconhecido (500 genérico + log).
 */
export const InternalErrorCodes = {
  INVENTORY_LOTS_INCONSISTENT: "INVENTORY_LOTS_INCONSISTENT",
  LOT_BOX_STOCKS_NOT_LOADED: "LOT_BOX_STOCKS_NOT_LOADED",
  INVALID_STOCK_MOVEMENT: "INVALID_STOCK_MOVEMENT",
  SALE_ITEM_INVALID: "SALE_ITEM_INVALID",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  LOCK_OUTSIDE_TRANSACTION: "LOCK_OUTSIDE_TRANSACTION",
} as const;

export class InternalInvariantError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "InternalInvariantError";
    this.code = code;
  }
}
