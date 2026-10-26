interface FieldErrorProps {
  /** Mesmo `id` passado a `fieldA11y` no campo (o erro recebe `<id>-error`). */
  id: string;
  message?: string;
  className?: string;
}

/** Id do elemento de erro de um campo. */
export const fieldErrorId = (id: string) => `${id}-error`;

/** Atributos de acessibilidade do campo: `aria-invalid` e `aria-describedby` apontando para o erro (só com erro). */
export function fieldA11y(id: string, error?: string | boolean | null) {
  return error
    ? ({ 'aria-invalid': true, 'aria-describedby': fieldErrorId(id) } as const)
    : ({} as { 'aria-invalid'?: true; 'aria-describedby'?: string });
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
