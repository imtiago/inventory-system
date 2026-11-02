import { formatMoneyInput, fromCents } from '@/shared/utils/money';

export interface ISplitRow {
  amount: string;
  dueDate: string;
}

export const MAX_SPLIT_PARCELS = 24;

/** Soma meses a uma data YYYY-MM-DD mantendo o dia (limitado ao último dia do mês de destino). */
export function addMonthsToDateOnly(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();

  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** N parcelas iguais (a última absorve os centavos que sobram) com vencimentos mensais a partir de `firstDate`. */
export function suggestSplit(totalCents: number, count: number, firstDate: string): ISplitRow[] {
  const base = Math.floor(totalCents / count);
  const rows: ISplitRow[] = [];

  for (let i = 0; i < count; i += 1) {
    const cents = i === count - 1 ? totalCents - base * (count - 1) : base;
    rows.push({ amount: formatMoneyInput(fromCents(cents)), dueDate: firstDate ? addMonthsToDateOnly(firstDate, i) : '' });
  }

  return rows;
}
