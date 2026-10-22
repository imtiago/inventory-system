import { DomainError } from "./DomainError";

export class ForbiddenError extends DomainError {
  constructor(message: string = "Acesso negado.", code: string = "FORBIDDEN") {
    super(message, code);
  }
}
