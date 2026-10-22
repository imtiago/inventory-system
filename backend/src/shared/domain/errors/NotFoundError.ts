import { DomainError } from "./DomainError";

export class NotFoundError extends DomainError {
  constructor(message: string, code: string = "NOT_FOUND") {
    super(message, code);
  }
}
