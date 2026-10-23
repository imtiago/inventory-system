const BUSINESS_TZ = "America/Sao_Paulo";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje ("YYYY-MM-DD") no fuso de negócio (America/Sao_Paulo). */
export function todayInBusinessTz(now: Date = new Date()): string {
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Hoje no fuso de negócio como Date à meia-noite UTC (convenção de datas sem hora). */
export function businessTodayAsUtcDate(now: Date = new Date()): Date {
  return new Date(`${todayInBusinessTz(now)}T00:00:00.000Z`);
}
