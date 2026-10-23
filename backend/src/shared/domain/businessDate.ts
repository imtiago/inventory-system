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

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Data ("YYYY-MM-DD") no fuso de negócio de uma data-hora ISO com fuso explícito
 * (ex.: `dhEmi` da NF-e). Sem fuso, formato inválido ou data inexistente → null.
 */
export function businessDateOfInstant(iso: string): string | null {
  if (!ISO_INSTANT.test(iso)) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  // Date normaliza dias inexistentes (31/02 → 03/03): confere a data local declarada.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const declared = new Date(Date.UTC(y, m - 1, d));
  if (declared.getUTCFullYear() !== y || declared.getUTCMonth() !== m - 1 || declared.getUTCDate() !== d) return null;
  return todayInBusinessTz(instant);
}
