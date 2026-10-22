import { DomainError } from "./DomainError";

export type FieldError = { field: string; message: string };

export class ValidationError extends DomainError {
  readonly errors: FieldError[];

  constructor(message: string, errors: FieldError[], code: string = "VALIDATION_ERROR") {
    super(message, code);
    this.errors = errors;
  }
}
