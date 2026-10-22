import { DomainError } from "./DomainError";

export class BusinessRuleError extends DomainError {
  constructor(message: string, code: string = "BUSINESS_RULE") {
    super(message, code);
  }
}
