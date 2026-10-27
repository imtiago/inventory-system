import { useMemo } from 'react';

import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { formatCurrency } from '@/shared/utils/money';
import { formatPercent } from '@/modules/reports/utils/formatPercent';

import type { PaymentSimulation, PriceMargin } from '../types';
import { conditionLabel } from '../utils/format';

interface Row {
  key: string;
  label: string;
  absorb: PaymentSimulation;
  /** Sem repasse da taxa não existe à vista. */
  passOn?: PaymentSimulation;
}

/** Junta as linhas "absorvendo a taxa" e "repassando a taxa" de cada forma de pagamento. */
function toRows(simulations: PaymentSimulation[]): Row[] {
  const rows: Row[] = [];
  for (const sim of simulations) {
    const key = `${sim.condition}-${sim.installments}`;
    const existing = rows.find((r) => r.key === key);
    if (sim.passOn) {
      if (existing) existing.passOn = sim;
      continue;
    }
    if (!existing) rows.push({ key, label: conditionLabel(sim.condition, sim.installments), absorb: sim });
  }

  return rows;
}

const margin = (m: PriceMargin) => (
  <span className={m.amount < 0 ? 'text-danger' : undefined}>
    {formatCurrency(m.amount)} ({formatPercent(m.percent)})
  </span>
);

const columns: DataTableColumn<Row>[] = [
  { id: 'label', header: 'Forma', mobile: 'title', cell: (r) => <span className="font-medium">{r.label}</span> },
  { id: 'absorbMargin', header: 'Margem (loja paga a taxa)', numeric: true, mobile: 'subtitle', cell: (r) => margin(r.absorb.margin) },
  { id: 'passPrice', header: 'Preço repassando a taxa', numeric: true, mobile: 'meta', cell: (r) => (r.passOn ? formatCurrency(r.passOn.price) : '—') },
  { id: 'passMargin', header: 'Margem repassando a taxa', numeric: true, mobile: 'meta', cell: (r) => (r.passOn ? margin(r.passOn.margin) : '—') },
];

/**
 * Preço e margem por forma de pagamento. "Loja paga a taxa": o cliente paga o preço de venda e a taxa sai da
 * margem; "repassando a taxa": o preço cobrado sobe para a margem ficar igual à de uma venda à vista.
 */
export function PaymentSimulator({ simulations, salePrice }: { simulations: PaymentSimulation[]; salePrice: number }) {
  const rows = useMemo(() => toRows(simulations), [simulations]);

  return (
    <div>
      <h3 id="payment-simulator-title" className="text-base font-semibold text-foreground">
        Simulador por forma de pagamento
      </h3>
      <p className="mb-2 text-sm text-muted">Preço de venda atual: {formatCurrency(salePrice)}. Em cartão a loja paga a taxa; repassando, o cliente paga mais.</p>
      <DataTable data={rows} columns={columns} getRowId={(r) => r.key} emptyMessage="Sem simulação" ariaLabelledBy="payment-simulator-title" />
    </div>
  );
}
