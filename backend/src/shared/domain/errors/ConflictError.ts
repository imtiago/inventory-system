import { DomainError } from "./DomainError";

export class ConflictError extends DomainError {
  constructor(message: string, code: string = "CONFLICT") {
    super(message, code);
  }
}
