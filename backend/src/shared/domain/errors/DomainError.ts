/** Dados extras do erro, enviados no corpo como `details` (ex.: `{ purchaseId }`). */
export type ErrorDetails = Record<string, unknown>;

export abstract class DomainError extends Error {
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(message: string, code: string, details?: ErrorDetails) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
