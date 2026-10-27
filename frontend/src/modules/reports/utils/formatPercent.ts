const formatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Percentual da API (ex.: 27.6) em pt-BR ("27,60%"); null vira traço. */
export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${formatter.format(value)}%`;
}
