import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";

/** Entrada inválida para o domínio do crédito: o chamador devia ter validado antes (bug → 500). */
export function invalidCreditInput(message: string): InternalInvariantError {
  return new InternalInvariantError(message, InternalErrorCodes.CREDIT_INPUT_INVALID);
}

export function assertNonNegativeInt(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw invalidCreditInput(`${name} must be a non-negative integer.`);
}

export function assertPositiveInt(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw invalidCreditInput(`${name} must be a positive integer.`);
}
