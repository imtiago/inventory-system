import { DomainError, ErrorDetails } from "./DomainError";

export class ConflictError extends DomainError {
  constructor(message: string, code: string = "CONFLICT", details?: ErrorDetails) {
    super(message, code, details);
  }
}
