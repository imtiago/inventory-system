import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/shared/components/LoadingState';
import { ExportButton } from '@/shared/components/export/ExportButton';
import { Section } from '@/shared/components/details/Section';
import { FilterBar, FILTER_FIELD, FILTER_GRID, FILTER_LABEL } from '@/shared/components/layout/FilterBar';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/table';
import type { DataTableColumn } from '@/shared/components/table';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { formatCurrency } from '@/shared/utils/money';

import { useProfitReport, useSellerOptions } from '../hooks/useProfitReport';
import type { IProfitRow, ProfitView } from '../types';
import { formatPercent } from '../utils/formatPercent';

const DAY_MS = 86_400_000;
const MAX_PERIOD_DAYS = 366;

const VIEWS: { value: ProfitView; label: string; header: string }[] = [
  { value: 'period', label: 'Período', header: 'Dia' },
  { value: 'sale', label: 'Venda', header: 'Venda' },
  { value: 'variant', label: 'Produto', header: 'Produto' },
  { value: 'category', label: 'Categoria', header: 'Categoria' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Summary({ label, value, id, tone }: { label: string; value: string; id: string; tone?: 'danger' }) {
  return (
    <div data-testid={id} className="min-w-0 rounded-lg border border-border p-3">
      <span className="block text-sm text-muted">{label}</span>
      <span className={`mt-1 block break-words text-lg font-semibold tabular-nums sm:text-xl ${tone === 'danger' ? 'text-danger' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function makeColumns(header: string): DataTableColumn<IProfitRow>[] {
  const bold = (row: IProfitRow) => (row.key === 'total' ? 'font-semibold' : '');

  return [
    { id: 'label', header, mobile: 'title', cell: (r) => <span className={`font-medium ${bold(r)}`}>{r.label}</span> },
    {
      id: 'profit',
      header: 'Lucro',
      numeric: true,
      mobile: 'subtitle',
      cell: (r) => <span className={`${bold(r)} ${r.profit < 0 ? 'text-danger' : ''}`}>{formatCurrency(r.profit)}</span>,
    },
    { id: 'margin', header: 'Margem', numeric: true, mobile: 'meta', cell: (r) => <span className={bold(r)}>{formatPercent(r.marginPercent)}</span> },
    { id: 'revenue', header: 'Receita', numeric: true, mobile: 'meta', cell: (r) => <span className={bold(r)}>{formatCurrency(r.revenue)}</span> },
    {
      id: 'cost',
      header: 'Custo',
      numeric: true,
      mobile: 'meta',
      cell: (r) => (
        <span className={`inline-flex flex-wrap items-center justify-end gap-2 ${bold(r)}`}>
          {formatCurrency(r.cost)}
          {r.itemsWithoutCost > 0 && <Badge tone="warning">{plural(r.itemsWithoutCost, 'item sem custo', 'itens sem custo')}</Badge>}
        </span>
      ),
    },
    { id: 'expenses', header: 'Despesas estimadas', numeric: true, mobile: 'meta', cell: (r) => <span className={bold(r)}>{formatCurrency(r.estimatedExpenses)}</span> },
  ];
}

export function ProfitReportPage() {
  const today = todayInBusinessTz();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [view, setView] = useState<ProfitView>('period');
  const [sellerId, setSellerId] = useState('');

  const periodTooLong = Boolean(from && to && from <= to && (Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > MAX_PERIOD_DAYS);
  const invalidPeriod = !from || !to || from > to || periodTooLong;

  const filters = { from, to, view, sellerId: sellerId || undefined };
  const { data: fetched, isLoading, isError } = useProfitReport(filters, !invalidPeriod);
  const data = invalidPeriod ? undefined : fetched;
  const sellers = useSellerOptions();

  const header = VIEWS.find((v) => v.value === view)!.header;
  const columns = useMemo(() => makeColumns(header), [header]);
  const tableRows = useMemo(() => (data ? [...data.rows, data.totals] : []), [data]);
  const totals = data?.totals;

  return (
    <Page>
      <PageHeader
        title="Lucro"
        description="Receita, custo registrado e despesas estimadas das vendas no período."
        actions={
          <ExportButton
            permission="reports.profit"
            url="/reports/profit.csv"
            params={{ from, to, view, sellerId: sellerId || undefined }}
            fallbackName={`lucro-${today}.csv`}
            disabled={invalidPeriod}
          />
        }
      />

      <Section>
        <div className="flex flex-1 flex-col">
          <FilterBar>
            <div role="group" aria-label="Agrupar por" className="flex flex-wrap gap-2">
              {VIEWS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={view === v.value}
                  onClick={() => setView(v.value)}
                  className={`min-h-11 rounded-lg border px-4 text-sm font-medium ${view === v.value ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-surface text-foreground hover:bg-surface-muted'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className={FILTER_GRID}>
              <div>
                <label htmlFor="profit-from" className={FILTER_LABEL}>De</label>
                <input id="profit-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={FILTER_FIELD} />
              </div>
              <div>
                <label htmlFor="profit-to" className={FILTER_LABEL}>Até</label>
                <input id="profit-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={FILTER_FIELD} />
              </div>
              <div>
                <label htmlFor="profit-seller" className={FILTER_LABEL}>Vendedor</label>
                <select id="profit-seller" value={sellerId} onChange={(e) => setSellerId(e.target.value)} className={FILTER_FIELD}>
                  <option value="">Todos</option>
                  {(sellers.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {invalidPeriod && (
              <p role="alert" className="text-sm text-danger">
                {periodTooLong ? `O período deve ter no máximo ${MAX_PERIOD_DAYS} dias.` : !from || !to ? 'Informe o período.' : 'Período inválido: a data inicial deve ser anterior ou igual à final.'}
              </p>
            )}
          </FilterBar>

          {totals && (
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Summary id="profit-revenue" label="Receita" value={formatCurrency(totals.revenue)} />
                <Summary id="profit-cost" label="Custo" value={formatCurrency(totals.cost)} />
                <Summary id="profit-expenses" label="Despesas estimadas" value={formatCurrency(totals.estimatedExpenses)} />
                <Summary id="profit-total" label="Lucro" value={formatCurrency(totals.profit)} tone={totals.profit < 0 ? 'danger' : undefined} />
                <Summary id="profit-margin-total" label="Margem" value={formatPercent(totals.marginPercent)} />
              </div>
              {totals.itemsWithoutCost > 0 && (
                <p role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                  {plural(totals.itemsWithoutCost, 'item sem custo registrado', 'itens sem custo registrado')}: o custo deles não entra na conta e o lucro pode estar acima do real.
                </p>
              )}
            </div>
          )}

          {invalidPeriod ? null : isError ? (
            <div role="alert" className="m-4 rounded-lg border border-danger/30 p-6 text-sm text-danger sm:m-5">
              Não foi possível carregar o relatório. Verifique sua conexão e tente novamente.
            </div>
          ) : isLoading ? (
            <LoadingState label="Carregando relatório..." />
          ) : (
            <div className="flex-1">
              <DataTable
                data={tableRows}
                columns={columns}
                emptyMessage="Nenhuma venda no período"
                emptyHint="Ajuste o período ou o vendedor."
                getRowId={(row) => `${row.key}`}
              />
            </div>
          )}
        </div>
      </Section>
    </Page>
  );
}

export default ProfitReportPage;
