/** Data e hora de um instante (ex.: createdAt) em pt-BR: "26/10/2026, 15:30". Para datas só-dia use `formatDateOnly`. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
