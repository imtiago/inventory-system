import { DomainError, ErrorDetails } from "./DomainError";

export class BusinessRuleError extends DomainError {
  constructor(message: string, code: string = "BUSINESS_RULE", details?: ErrorDetails) {
    super(message, code, details);
  }
}
