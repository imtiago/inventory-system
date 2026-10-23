import { ConflictError, ErrorCodes, NotFoundError, ValidationError } from "@shared/domain/errors";

export const nfeImportNotFound = () =>
  new NotFoundError("Importação não encontrada.", ErrorCodes.NFE_IMPORT_NOT_FOUND);

/** Chave já confirmada: `details` leva o pedido gerado e a importação, para o front oferecer o link. */
export const nfeAlreadyImported = (details: { purchaseId: string | null; importId: string }) =>
  new ConflictError("Esta NF-e já foi importada.", ErrorCodes.NFE_ALREADY_IMPORTED, details);

export const nfeImportConfirmed = () =>
  new ConflictError("Importação já confirmada.", ErrorCodes.NFE_IMPORT_CONFIRMED);

export const unsupportedFileType = () =>
  new ValidationError(
    "Envie o arquivo XML da NF-e.",
    [{ field: "file", message: "Envie o arquivo XML da NF-e." }],
    ErrorCodes.UNSUPPORTED_FILE_TYPE,
  );

export const fileRequired = () =>
  new ValidationError(
    "Arquivo obrigatório.",
    [{ field: "file", message: "Arquivo obrigatório." }],
    ErrorCodes.FILE_REQUIRED,
  );
