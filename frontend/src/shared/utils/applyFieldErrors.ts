import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import { parseApiErrorSync } from '../services/parseApiError';

export type ApplyFieldErrorsResult = {
  /** Fields (from knownFields) that received an error. */
  applied: string[];
  /** Backend errors for fields the form does not render; the caller must surface them. */
  unmatched: Record<string, string>;
};

/** Applies backend field errors (dotted paths allowed) only to the listed known fields; returns the rest. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string>,
  knownFields: readonly string[],
): ApplyFieldErrorsResult {
  const applied: string[] = [];
  const unmatched: Record<string, string> = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (knownFields.includes(field)) {
      setError(field as FieldPath<T>, { type: 'server', message });
      applied.push(field);
    } else {
      unmatched[field] = message;
    }
  }

  return { applied, unmatched };
}

/**
 * Handles an error thrown by a form submit: known fields get inline errors, anything else becomes a
 * form-level message (errors.root.server). Returns false when the error has no field errors (caller rethrows).
 */
export function applySubmitError<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  knownFields: readonly string[],
): boolean {
  const { fieldErrors } = parseApiErrorSync(error);

  if (Object.keys(fieldErrors).length === 0) return false;

  const { unmatched } = applyFieldErrors(setError, fieldErrors, knownFields);
  const messages = Object.values(unmatched);

  if (messages.length > 0) {
    setError('root.server' as FieldPath<T>, { type: 'server', message: messages.join(' ') });
  }

  return true;
}
