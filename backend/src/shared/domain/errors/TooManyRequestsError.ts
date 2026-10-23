import { DomainError } from "./DomainError";

export class TooManyRequestsError extends DomainError {
  constructor(
    message: string = "Muitas tentativas. Tente novamente em alguns minutos.",
    code: string = "TOO_MANY_ATTEMPTS",
  ) {
    super(message, code);
  }
}
