import { formatCurrency } from '@/shared/utils/money';

import type { ISaleSimulation } from '../../types';
import { CARD_INSTALLMENTS, findCondition } from '../../utils/checkout';
import { checkoutFieldClass, checkoutLabelClass } from './styles';

interface Props {
  condition: 'DEBIT_CARD' | 'CREDIT_CARD';
  passCardFee: boolean;
  onPassCardFeeChange: (value: boolean) => void;
  cardInstallments: number;
  onCardInstallmentsChange: (value: number) => void;
  simulation: ISaleSimulation | undefined;
  disabled?: boolean;
}

/** Cartão: repasse da taxa (ligado por padrão) e, no crédito, 1x a 12x com o valor de cada uma. */
export function CardOptions({ condition, passCardFee, onPassCardFeeChange, cardInstallments, onCardInstallmentsChange, simulation, disabled = false }: Props) {
  const isCredit = condition === 'CREDIT_CARD';

  function installmentLabel(n: number): string {
    const row = findCondition(simulation, { condition: 'CREDIT_CARD', cardInstallments: n, passCardFee });
    if (!row) return `${n}x`;
    return n === 1 ? `1x de ${formatCurrency(row.total)}` : `${n}x de ${formatCurrency(row.total / n)} (${formatCurrency(row.total)})`;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {isCredit && (
        <div>
          <label htmlFor="card-installments" className={checkoutLabelClass}>
            Parcelas no cartão
          </label>
          <select id="card-installments" className={checkoutFieldClass} value={cardInstallments} disabled={disabled} onChange={(event) => onCardInstallmentsChange(Number(event.target.value))}>
            {CARD_INSTALLMENTS.map((n) => (
              <option key={n} value={n}>
                {installmentLabel(n)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">A maquininha cuida do parcelamento; a loja recebe na hora.</p>
        </div>
      )}

      <div className={`flex items-center justify-between gap-4 rounded-lg border p-3 ${isCredit ? '' : 'sm:col-span-2'}`}>
        <div className="min-w-0">
          <span id="pass-card-fee-label" className="text-sm font-medium">
            Repassar taxa ao cliente
          </span>
          <p id="pass-card-fee-state" className="text-xs text-muted">
            {passCardFee ? 'O cliente paga a taxa da maquininha.' : 'A loja absorve a taxa da maquininha.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={passCardFee}
          aria-labelledby="pass-card-fee-label"
          aria-describedby="pass-card-fee-state"
          disabled={disabled}
          onClick={() => onPassCardFeeChange(!passCardFee)}
          className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-50 ${passCardFee ? 'border-primary bg-primary' : 'border-foreground/50 bg-surface-muted'}`}
        >
          <span aria-hidden="true" className={`inline-block h-7 w-7 rounded-full shadow transition-transform ${passCardFee ? 'translate-x-7 bg-primary-foreground' : 'translate-x-1 bg-foreground/60'}`} />
        </button>
      </div>
    </div>
  );
}
