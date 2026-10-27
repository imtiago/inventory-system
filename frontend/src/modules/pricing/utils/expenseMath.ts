/** Valor mensal ÷ faturamento mensal em bps (meio para cima, só inteiros). null se não der para calcular. */
export function expenseBpsFromMonthly(monthlyCents: number | null, revenueCents: number | null): number | null {
  if (monthlyCents === null || revenueCents === null || revenueCents <= 0 || monthlyCents < 0) return null;

  return Math.floor((monthlyCents * 20000 + revenueCents) / (2 * revenueCents));
}
