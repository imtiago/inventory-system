import { BusinessRuleError, ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

export const purchaseNotFound = () =>
  new NotFoundError("Pedido de compra não encontrado.", ErrorCodes.PURCHASE_NOT_FOUND);
export const purchaseAlreadyCanceled = () =>
  new ConflictError("Pedido já está cancelado.", ErrorCodes.PURCHASE_ALREADY_CANCELED);
export const purchaseHasReceipts = () =>
  new ConflictError("Pedido com recebimentos não pode ser cancelado.", ErrorCodes.PURCHASE_HAS_RECEIPTS);
export const invalidItemTotal = () =>
  new BusinessRuleError("Total do item não pode ser negativo.", ErrorCodes.INVALID_ITEM_TOTAL);
export const purchaseTotalZero = () =>
  new BusinessRuleError("O total do pedido deve ser maior que zero.", ErrorCodes.PURCHASE_TOTAL_ZERO);
