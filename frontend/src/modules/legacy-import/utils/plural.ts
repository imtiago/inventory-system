/** "1 linha" / "3 linhas". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? singular : pluralForm}`;
}

/** Números de linha separados por vírgula: "3, 6". */
export function joinLines(lines: number[]): string {
  return lines.join(', ');
}
