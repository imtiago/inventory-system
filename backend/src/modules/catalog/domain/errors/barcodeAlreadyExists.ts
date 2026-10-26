import { ConflictError, ErrorCodes } from "@shared/domain/errors";

export const barcodeAlreadyExists = () =>
  new ConflictError("Código de barras já cadastrado.", ErrorCodes.BARCODE_ALREADY_EXISTS);
