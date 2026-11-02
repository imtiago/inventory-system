import { buildInstallments } from "@shared/domain/installments";
import { assertPositiveInt, invalidCreditInput } from "./creditInput";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" (data de negócio) → Date à meia-noite UTC; rejeita datas inexistentes. */
export function parseDateOnly(day: string, name = "date"): Date {
  const match = DATE_ONLY.exec(day);
  if (match) {
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) return date;
  }
  throw invalidCreditInput(`${name} must be a valid YYYY-MM-DD date.`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Dias corridos de `from` até `to` (negativo se `to` for antes). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / DAY_MS);
}

/**
 * Vencimentos do crediário ("YYYY-MM-DD"), a partir de `today` (data de negócio
 * em São Paulo, `todayInBusinessTz`). Base = hoje + 30 dias.
 * - dueDay null → 1º vencimento na base; os demais mensais no mesmo dia.
 * - dueDay d (1–28) → 1º vencimento no primeiro dia d ≥ base; depois mensais.
 * Mês sem o dia → último dia do mês (como `buildInstallments`).
 */
export function crediarioDueDates(today: string, installments: number, dueDay: number | null): string[] {
  const start = parseDateOnly(today, "today");
  assertPositiveInt(installments, "installments");
  if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28)) {
    throw invalidCreditInput("dueDay must be an integer between 1 and 28.");
  }

  const base = new Date(start.getTime() + 30 * DAY_MS);
  let first = base;
  if (dueDay !== null) {
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    first = base.getUTCDate() <= dueDay ? new Date(Date.UTC(y, m, dueDay)) : new Date(Date.UTC(y, m + 1, dueDay));
  }
  return buildInstallments(0, installments, first).map((p) => formatDateOnly(p.dueDate));
}
