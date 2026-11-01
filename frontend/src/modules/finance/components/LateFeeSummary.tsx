import { formatCents, toCents } from '@/shared/utils/money';

import type { ILateFeeQuote } from '../types';

interface Props {
  quote: ILateFeeQuote;
  /** Principal informado neste pagamento (centavos). */
  amountCents: number;
  /** Dispensa informada (centavos). */
  waivedCents: number;
}

function Row({ id, label, value, strong = false }: { id: string; label: string; value: string; strong?: boolean }) {
  return (
    <div data-testid={`late-fee-${id}`} className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold text-foreground' : ''}`}>
      <dt className={strong ? '' : 'text-muted'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Principal, multa, juros, total devido e recebido em caixa do pagamento de uma parcela a receber. */
export function LateFeeSummary({ quote, amountCents, waivedCents }: Props) {
  const fineCents = toCents(quote.fine);
  const interestCents = toCents(quote.interest);
  const hasFees = fineCents + interestCents > 0;
  const receivedCents = Math.max(0, amountCents) + fineCents + interestCents - waivedCents;
  const days = quote.daysLate === 1 ? '1 dia' : `${quote.daysLate} dias`;

  return (
    <section aria-label="Multa e juros" className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
      {!hasFees && (
        <p className="mb-2 text-muted">
          Sem multa nem juros{quote.daysLate > 0 ? ` (${days} de atraso, dentro da carência ou sem encargos)` : ''}.
        </p>
      )}
      <dl className="flex flex-col gap-1.5">
        <Row id="principal" label="Restante da parcela" value={formatCents(toCents(quote.principalRemaining))} />
        {hasFees && (
          <>
            <Row id="fine" label="Multa" value={formatCents(fineCents)} />
            <Row id="interest" label={`Juros (${days} de atraso)`} value={formatCents(interestCents)} />
            <Row id="total-due" label="Total devido" value={formatCents(toCents(quote.totalDue))} strong />
          </>
        )}
        {waivedCents > 0 && <Row id="waived" label="Dispensado" value={`− ${formatCents(waivedCents)}`} />}
        <div className="mt-1 border-t border-border pt-2">
          <Row id="received" label="Total recebido em caixa" value={formatCents(receivedCents)} strong />
        </div>
      </dl>
    </section>
  );
}
