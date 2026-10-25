import { BusinessRuleError, ConflictError, ErrorCodes, NotFoundError, ValidationError } from "@shared/domain/errors";

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

export const fileTooLarge = () =>
  new ValidationError(
    "Arquivo maior que 10 MB.",
    [{ field: "file", message: "Arquivo maior que 10 MB." }],
    ErrorCodes.FILE_TOO_LARGE,
  );

/** Duas tentativas seguidas perderam a corrida pela chave de acesso. */
export const concurrentUpload = () =>
  new ConflictError("Operação em andamento para este item. Tente novamente.", ErrorCodes.CONCURRENT_UPDATE);

export const supplierDocumentMismatch = () =>
  new BusinessRuleError("O fornecedor escolhido não é o emitente da nota.", ErrorCodes.SUPPLIER_DOCUMENT_MISMATCH);

export const nfeQuantityNotInteger = (index: number) =>
  new BusinessRuleError(
    `Quantidade do item ${index} não resulta em unidades inteiras.`,
    ErrorCodes.NFE_QUANTITY_NOT_INTEGER,
  );

export const nfeUnsupportedItem = (index: number) =>
  new BusinessRuleError(
    `Item ${index} não compõe o total da nota; importação não suportada.`,
    ErrorCodes.NFE_UNSUPPORTED_ITEM,
  );

/** Unidades do item (qCom × unidades por embalagem) acima do teto do pedido. */
export const nfeItemUnitsTooLarge = (index: number) =>
  new BusinessRuleError(
    `Item ${index}: quantidade em unidades acima do máximo permitido (1.000.000).`,
    ErrorCodes.INVALID_NFE,
  );

/** Valor do item do pedido (preço, desconto, frete, imposto ou total) acima de DECIMAL(12,2). */
export const nfeItemAmountTooLarge = (index: number) =>
  new BusinessRuleError(`Item ${index}: valor acima do máximo permitido.`, ErrorCodes.INVALID_NFE);

/** Total do pedido gerado da nota acima de DECIMAL(12,2). */
export const nfeTotalTooLarge = () =>
  new BusinessRuleError("O total da nota excede o máximo permitido.", ErrorCodes.INVALID_NFE);

/** Lotes (rastro) somando mais unidades que o próprio item: nota inconsistente. */
export const nfeLotsExceedQuantity = (index: number) =>
  new BusinessRuleError(`Os lotes do item ${index} excedem a quantidade do item.`, ErrorCodes.INVALID_NFE);
