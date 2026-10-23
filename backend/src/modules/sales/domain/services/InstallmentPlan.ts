import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";

export interface Installment {
  amountCents: number;
  dueDate: Date;
}

function daysInMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Plano de parcelas: cada parcela = floor(total / n); a última recebe o resto
 * (soma exata). Vencimentos mensais no mesmo dia do mês do primeiro; em meses
 * sem esse dia, o último dia do mês. Datas em UTC (meia-noite).
 */
export function buildInstallments(
  totalCents: number,
  installments: number,
  firstDueDate: Date,
): Installment[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new InternalInvariantError("Total must be a non-negative integer in cents.", InternalErrorCodes.INSTALLMENT_PLAN_INVALID);
  }
  if (!Number.isInteger(installments) || installments < 1) {
    throw new InternalInvariantError("Installments must be a positive integer.", InternalErrorCodes.INSTALLMENT_PLAN_INVALID);
  }
  if (Number.isNaN(firstDueDate.getTime())) {
    throw new InternalInvariantError("First due date is invalid.", InternalErrorCodes.INSTALLMENT_PLAN_INVALID);
  }

  const base = Math.floor(totalCents / installments);
  const year = firstDueDate.getUTCFullYear();
  const month = firstDueDate.getUTCMonth();
  const day = firstDueDate.getUTCDate();

  return Array.from({ length: installments }, (_, i) => {
    const targetYear = year + Math.floor((month + i) / 12);
    const targetMonth = (month + i) % 12;
    const targetDay = Math.min(day, daysInMonthUtc(targetYear, targetMonth));
    return {
      amountCents: i === installments - 1 ? totalCents - base * (installments - 1) : base,
      dueDate: new Date(Date.UTC(targetYear, targetMonth, targetDay)),
    };
  });
}
