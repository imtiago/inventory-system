import { ConflictError, ErrorCodes } from "@shared/domain/errors";

export const customerDocumentExists = () =>
  new ConflictError("Já existe cliente com este CPF/CNPJ.", ErrorCodes.CUSTOMER_DOCUMENT_EXISTS);
