import { DomainError, ErrorDetails } from "./DomainError";

export class NotFoundError extends DomainError {
  constructor(message: string, code: string = "NOT_FOUND", details?: ErrorDetails) {
    super(message, code, details);
  }
}
