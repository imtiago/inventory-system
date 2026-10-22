import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

/** Applies backend field errors (dotted paths) to a react-hook-form; returns whether any was applied. */
export function applyFieldErrors<T extends FieldValues>(setError: UseFormSetError<T>, fieldErrors: Record<string, string>): boolean {
  const entries = Object.entries(fieldErrors);

  for (const [field, message] of entries) {
    setError(field as FieldPath<T>, { type: 'server', message });
  }

  return entries.length > 0;
}
