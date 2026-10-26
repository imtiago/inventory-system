/** Id do elemento de erro de um campo (`<id>-error`). */
export const fieldErrorId = (id: string) => `${id}-error`;

/** Atributos de acessibilidade do campo: `aria-invalid` e `aria-describedby` apontando para o erro (só com erro). */
export function fieldA11y(id: string, error?: string | boolean | null) {
  return error
    ? ({ 'aria-invalid': true, 'aria-describedby': fieldErrorId(id) } as const)
    : ({} as { 'aria-invalid'?: true; 'aria-describedby'?: string });
}
