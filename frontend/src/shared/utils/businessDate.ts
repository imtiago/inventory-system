const BUSINESS_TZ = 'America/Sao_Paulo';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data de hoje ("YYYY-MM-DD") no fuso de negócio (America/Sao_Paulo), igual ao servidor. */
export function todayInBusinessTz(now: Date = new Date()): string {
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));

  return `${parts.year}-${parts.month}-${parts.day}`;
}
