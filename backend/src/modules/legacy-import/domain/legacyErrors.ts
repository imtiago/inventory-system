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

/** Máximo de linhas de um lote (CSV e lançamento rápido somados). */
export const MAX_BATCH_ROWS = 500;

export const legacyTooManyRows = () =>
  new BusinessRuleError(
    `Lote grande demais (máx. ${MAX_BATCH_ROWS} linhas). Divida o caderninho em mais de um arquivo.`,
    ErrorCodes.LEGACY_BATCH_TOO_LARGE,
    { max: MAX_BATCH_ROWS },
  );

export const legacyBatchHasErrors = (lines: number[]) =>
  new BusinessRuleError("Corrija as linhas com erro antes de confirmar.", ErrorCodes.LEGACY_BATCH_HAS_ERRORS, { lines });

export const legacyUnresolvedSimilarNames = (lines: number[]) =>
  new BusinessRuleError("Decida se os nomes parecidos são a mesma pessoa.", ErrorCodes.UNRESOLVED_SIMILAR_NAMES, { lines });

export const legacyUnresolvedDuplicates = (lines: number[]) =>
  new BusinessRuleError(
    'Há dívidas que parecem já importadas. Em cada linha, escolha "Importar mesmo assim" ou ignore a linha.',
    ErrorCodes.UNRESOLVED_DUPLICATES,
    { lines },
  );

export const legacyBatchEmpty = () =>
  new BusinessRuleError("O lote não tem linhas para confirmar.", ErrorCodes.LEGACY_BATCH_EMPTY);

export const legacyLinkedCustomerMissing = (lines: number[]) =>
  new NotFoundError(
    `Cliente vinculado não existe mais (linha ${lines.join(", ")}). Revise o vínculo.`,
    ErrorCodes.CUSTOMER_NOT_FOUND,
    { lines },
  );

export const legacyBatchNotConfirmed = () =>
  new ConflictError("Só um lote confirmado pode ser desfeito.", ErrorCodes.LEGACY_BATCH_NOT_CONFIRMED);

export const legacyBatchHasPayments = () =>
  new ConflictError("Alguma dívida deste lote já recebeu pagamento.", ErrorCodes.LEGACY_BATCH_HAS_PAYMENTS);
