export interface Installment {
  amountCents: number;
  /** Date-only "YYYY-MM-DD". */
  dueDate: string;
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

/**
 * Mesma regra do backend (InstallmentPlan): piso por parcela, resto na última;
 * vencimentos mensais no mesmo dia do primeiro, recortado ao fim do mês (recalculado a partir do dia original). UTC.
 */
export function buildInstallments(totalCents: number, installments: number, firstDueDate: string): Installment[] {
  const [year, month, day] = firstDueDate.split('-').map(Number);
  const base = Math.floor(totalCents / installments);

  return Array.from({ length: installments }, (_, i) => {
    const targetYear = year + Math.floor((month - 1 + i) / 12);
    const targetMonth = (month - 1 + i) % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(day, lastDay);

    return {
      amountCents: i === installments - 1 ? totalCents - base * (installments - 1) : base,
      dueDate: `${pad(targetYear, 4)}-${pad(targetMonth + 1)}-${pad(targetDay)}`,
    };
  });
}

/** Data local (não UTC) + N dias, formatada YYYY-MM-DD. */
export function addDaysLocal(from: Date, days: number): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);

  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
