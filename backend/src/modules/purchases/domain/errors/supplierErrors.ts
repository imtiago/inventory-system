import { ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

export const supplierNotFound = () =>
  new NotFoundError("Fornecedor não encontrado.", ErrorCodes.SUPPLIER_NOT_FOUND);
export const supplierDocumentAlreadyExists = () =>
  new ConflictError(
    "Já existe um fornecedor com esse documento.",
    ErrorCodes.SUPPLIER_DOCUMENT_ALREADY_EXISTS,
  );
export const supplierInUse = () =>
  new ConflictError(
    "Fornecedor possui pedidos de compra e não pode ser excluído.",
    ErrorCodes.SUPPLIER_IN_USE,
  );
