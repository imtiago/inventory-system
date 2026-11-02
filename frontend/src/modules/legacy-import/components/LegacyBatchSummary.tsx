import { formatCurrency } from '@/shared/utils/money';

import type { LegacyBatchSummary as Summary } from '../types';

interface Props {
  summary: Summary;
}

/** Resumo do lote: clientes novos e existentes, total em aberto e linhas com aviso/erro/ignoradas. */
export function LegacyBatchSummary({ summary }: Props) {
  const items = [
    { id: 'summary-new', label: 'Clientes novos', value: String(summary.newCustomers), tone: 'text-foreground' },
    { id: 'summary-existing', label: 'Clientes existentes', value: String(summary.existingCustomers), tone: 'text-foreground' },
    { id: 'summary-open', label: 'Total em aberto', value: formatCurrency(summary.openTotal), tone: 'text-foreground' },
    { id: 'summary-warnings', label: 'Linhas com aviso', value: String(summary.warnings), tone: summary.warnings > 0 ? 'text-warning' : 'text-foreground' },
    { id: 'summary-errors', label: 'Linhas com erro', value: String(summary.errors), tone: summary.errors > 0 ? 'text-danger' : 'text-foreground' },
    { id: 'summary-ignored', label: 'Linhas ignoradas', value: String(summary.ignored), tone: 'text-foreground' },
  ];

  return (
    <section aria-label="Resumo do lote" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.id} className="min-w-0 rounded-xl bg-surface p-4 shadow">
          <p className="text-sm text-muted">{item.label}</p>
          <p data-testid={item.id} className={`mt-1 break-words text-xl font-semibold tabular-nums ${item.tone}`}>
            {item.value}
          </p>
        </div>
      ))}
    </section>
  );
}
