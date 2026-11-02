import { formatCurrency } from '@/shared/utils/money';

interface Props {
  /** Preço à vista (itens). */
  cashPrice: number;
  /** Valor final na condição escolhida (null enquanto não há opção/simulação). */
  total: number | null;
  /** Ex.: "Crédito 3x", "Crediário 5x". */
  conditionLabel: string;
  /** Só para quem vê lucro; null = custo não registrado. Ausente = não mostra. */
  margin?: { amount: number; percent: number } | null;
}

const percent = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** "À vista R$ X × a prazo": preço base, acréscimo da condição e o total a cobrar. */
export function CheckoutSummary({ cashPrice, total, conditionLabel, margin }: Props) {
  const surcharge = total === null ? 0 : Math.max(Math.round(total * 100) - Math.round(cashPrice * 100), 0) / 100;

  return (
    <div data-testid="checkout-summary" className="flex min-w-0 items-end justify-between gap-3">
      <dl className="grid min-w-0 grid-cols-[auto_auto] gap-x-2 gap-y-0.5 text-xs sm:gap-x-3 sm:text-sm">
        <dt className="text-muted">À vista</dt>
        <dd className="text-right tabular-nums">{formatCurrency(cashPrice)}</dd>
        {surcharge > 0 && (
          <>
            <dt className="text-muted">Acréscimo</dt>
            <dd className="text-right tabular-nums">{formatCurrency(surcharge)}</dd>
          </>
        )}
        {margin !== undefined && (
          <>
            <dt className="text-muted">Margem</dt>
            <dd data-testid="checkout-margin" className="text-right tabular-nums">
              {margin ? `${formatCurrency(margin.amount)} (${percent(margin.percent)})` : '—'}
            </dd>
          </>
        )}
      </dl>

      <div className="shrink-0 text-right">
        <p className="text-xs text-muted sm:text-sm">{conditionLabel}</p>
        <p data-testid="checkout-total" className="text-xl font-semibold tabular-nums sm:text-2xl">
          {total === null ? '—' : formatCurrency(total)}
        </p>
      </div>
    </div>
  );
}
