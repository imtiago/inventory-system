import { ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

export const brandNotFound = () =>
  new NotFoundError("Marca não encontrada.", ErrorCodes.BRAND_NOT_FOUND);
export const brandAlreadyExists = () =>
  new ConflictError("Já existe uma marca com esse nome.", ErrorCodes.BRAND_ALREADY_EXISTS);
export const brandInUse = () =>
  new ConflictError("Marca possui produtos e não pode ser excluída.", ErrorCodes.BRAND_IN_USE);

export const categoryNotFound = () =>
  new NotFoundError("Categoria não encontrada.", ErrorCodes.CATEGORY_NOT_FOUND);
export const categoryAlreadyExists = () =>
  new ConflictError("Já existe uma categoria com esse nome.", ErrorCodes.CATEGORY_ALREADY_EXISTS);
export const categoryInUse = () =>
  new ConflictError("Categoria possui produtos e não pode ser excluída.", ErrorCodes.CATEGORY_IN_USE);
