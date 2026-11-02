import { BusinessRuleError, ConflictError, ErrorCodes, NotFoundError, ValidationError } from "@shared/domain/errors";

export const legacyBatchNotFound = () =>
  new NotFoundError("Lote não encontrado.", ErrorCodes.LEGACY_BATCH_NOT_FOUND);

export const legacyRowNotFound = () =>
  new NotFoundError("Linha do lote não encontrada.", ErrorCodes.LEGACY_ROW_NOT_FOUND);

export const legacyBatchNotDraft = () =>
  new ConflictError("O lote já foi confirmado ou desfeito e não pode mais ser alterado.", ErrorCodes.LEGACY_BATCH_NOT_DRAFT);

export const legacyInvalidTarget = () =>
  new BusinessRuleError("Escolha outra linha do lote (não ignorada e diferente desta).", ErrorCodes.LEGACY_ROW_INVALID_TARGET);

export const legacyCustomerNotFound = () =>
  new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);

export const legacyFileTooLarge = () =>
  new ValidationError("Arquivo maior que 1 MB.", [{ field: "file", message: "Arquivo maior que 1 MB." }], ErrorCodes.FILE_TOO_LARGE);

export const legacyFileEmpty = () =>
  new ValidationError("O arquivo não tem linhas para importar.", [{ field: "file", message: "O arquivo não tem linhas para importar." }]);

export const legacyTooManyRows = () =>
  new ValidationError("Lote grande demais (máx. 2.000 linhas).", []);
