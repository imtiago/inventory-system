import { DomainError } from "./DomainError";

export class UnauthorizedError extends DomainError {
  constructor(message: string, code: string = "UNAUTHENTICATED") {
    super(message, code);
  }
}
