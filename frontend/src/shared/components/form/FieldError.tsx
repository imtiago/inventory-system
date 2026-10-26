import { fieldErrorId } from './fieldA11y';

interface FieldErrorProps {
  /** Mesmo `id` passado a `fieldA11y` no campo (o erro recebe `<id>-error`). */
  id: string;
  message?: string;
  className?: string;
}

/** Mensagem de erro de um campo, ligada a ele por `fieldA11y`. Não renderiza nada sem mensagem. */
export function FieldError({ id, message, className = 'mt-1 text-sm text-danger' }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={fieldErrorId(id)} className={className}>
      {message}
    </p>
  );
}
