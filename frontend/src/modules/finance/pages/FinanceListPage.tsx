import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { CrudPagination } from '@/shared/components/crud';
import { StatusBadge } from '@/components/ui/badge';
import { FilterBar, FILTER_FIELD, FILTER_GRID, FILTER_LABEL } from '@/shared/components/layout/FilterBar';
import { FilterPanel } from '@/shared/components/layout/FilterPanel';
import { Section } from '@/shared/components/details/Section';
import { ExportButton } from '@/shared/components/export/ExportButton';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Page } from '@/shared/components/layout/Page';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { PartyFilter } from '../components/PartyFilter';
import { FINANCE_KINDS, partyOf, summaryValue, type FinanceKind } from '../config';
import { useFinanceList } from '../hooks/useFinanceList';
import { FINANCE_STATUS_LABELS, type IFinanceFilters, type IFinanceListItem, type FinanceStatus } from '../types';

const STATUSES = Object.keys(FINANCE_STATUS_LABELS) as FinanceStatus[];

type FilterKey = 'status' | 'customerId' | 'supplierId' | 'dueFrom' | 'dueTo' | 'openOnly';

function SummaryCard({ id, label, value }: { id: string; label: string; value?: number }) {
  return (
    <div data-testid={`summary-${id}`} className="rounded-xl border bg-surface p-4 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{formatCurrency(value ?? 0)}</p>
    </div>
  );
}

function buildColumns(kind: FinanceKind): DataTableColumn<IFinanceListItem>[] {
  const config = FINANCE_KINDS[kind];

  return [
  {
    id: 'party',
    header: config.partyLabel,
    mobile: 'title',
    cell: (item) => partyOf(kind, item)?.name ?? '—',
  },
  {
    id: 'origin',
    header: config.originColumn,
    mobile: 'subtitle',
    cell: (item) =>
      item.originType === config.originType ? (
        <Link to={config.originHref(item)} className="hover:underline">
          {config.originText(item)}
        </Link>
      ) : (
        item.originType
      ),
  },
  { id: 'total', header: 'Total', mobile: 'meta', numeric: true, cell: (item) => formatCurrency(item.totalAmount) },
  { id: 'paid', header: 'Pago', mobile: 'meta', numeric: true, cell: (item) => formatCurrency(item.paidAmount) },
  { id: 'remaining', header: 'Saldo', mobile: 'meta', numeric: true, cell: (item) => formatCurrency(item.remainingAmount) },
  { id: 'nextDueDate', header: 'Próx. vencimento', mobile: 'meta', align: 'center', cell: (item) => formatDateOnly(item.nextDueDate) },
  {
    id: 'status',
    header: 'Status',
    mobile: 'meta',
    cell: (item) => <StatusBadge status={item.displayStatus}>{FINANCE_STATUS_LABELS[item.displayStatus] ?? item.displayStatus}</StatusBadge>,
  },
  {
    id: 'actions',
    header: '',
    mobile: 'hidden',
    align: 'center',
    cell: (item) => (
      <Link to={`${config.basePath}/${item.id}`} className="whitespace-nowrap text-sm font-medium text-primary hover:underline">
        Ver conta
      </Link>
    ),
  },
  ];
}

export function FinanceListPage({ kind }: { kind: FinanceKind }) {
  const config = FINANCE_KINDS[kind];
  const columns = useMemo(() => buildColumns(kind), [kind]);
  const [searchParams, setSearchParams] = useSearchParams();

  const rawStatus = searchParams.get('status');
  const filters: IFinanceFilters = {
    status: STATUSES.includes(rawStatus as FinanceStatus) ? (rawStatus as FinanceStatus) : undefined,
    [config.partyFilterKey]: searchParams.get(config.partyFilterKey) || undefined,
    dueFrom: searchParams.get('dueFrom') || undefined,
    dueTo: searchParams.get('dueTo') || undefined,
    openOnly: searchParams.get('openOnly') === 'true' || undefined,
  };
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const invalidRange = Boolean(filters.dueFrom && filters.dueTo && filters.dueFrom > filters.dueTo);
  const { data, isLoading, isFetching, isError } = useFinanceList(kind, page, filters, !invalidRange);

  function setFilter(key: FilterKey, value: string | null) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  function setPage(nextPage: number) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('page', String(nextPage));
        return next;
      },
      { replace: true },
    );
  }

  const totalPages = data?.pagination.totalPages ?? 1;

  // Clamp a page beyond the last one (e.g. stale bookmark) to the last page.
  useEffect(() => {
    if (data && data.pagination.totalPages >= 1 && page > data.pagination.totalPages) {
      setPage(data.pagination.totalPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, page]);

  return (
    <Page>
      <PageHeader
        title={`${config.title} (${data?.pagination.total ?? 0})`}
        actions={
          <ExportButton
            permission={config.exportPermission}
            url={config.exportPath}
            params={{ ...filters }}
            fallbackName={`${config.exportFilePrefix}-${todayInBusinessTz()}.csv`}
            disabled={invalidRange}
          />
        }
      />

      <Section>
        <div className="flex flex-1 flex-col">
          <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-3 sm:p-5">
            <SummaryCard id="open" label="A vencer" value={data?.summary.openAmount} />
            <SummaryCard id="overdue" label="Vencido" value={data?.summary.overdueAmount} />
            <SummaryCard id={config.summaryId} label={config.summaryLabel} value={summaryValue(kind, data?.summary)} />
          </div>

          <FilterBar>
          <FilterPanel activeCount={[filters.status, filters[config.partyFilterKey], filters.dueFrom, filters.dueTo, filters.openOnly].filter(Boolean).length}>
          <div className={FILTER_GRID}>
            <div>
              <label htmlFor={`${kind}-status`} className={FILTER_LABEL}>
                Status
              </label>
              <select id={`${kind}-status`} value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className={FILTER_FIELD}>
                <option value="">Todos</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {FINANCE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <PartyFilter kind={kind} value={filters[config.partyFilterKey]} onChange={(value) => setFilter(config.partyFilterKey, value)} />

            <div>
              <label htmlFor={`${kind}-due-from`} className={FILTER_LABEL}>
                Vencimento de
              </label>
              <input id={`${kind}-due-from`} type="date" value={filters.dueFrom ?? ''} max={filters.dueTo} onChange={(e) => setFilter('dueFrom', e.target.value)} className={FILTER_FIELD} />
            </div>

            <div>
              <label htmlFor={`${kind}-due-to`} className={FILTER_LABEL}>
                Vencimento até
              </label>
              <input id={`${kind}-due-to`} type="date" value={filters.dueTo ?? ''} min={filters.dueFrom} onChange={(e) => setFilter('dueTo', e.target.value)} className={FILTER_FIELD} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={Boolean(filters.openOnly)} onChange={(e) => setFilter('openOnly', e.target.checked ? 'true' : null)} />
            Somente com saldo
          </label>
          </FilterPanel>

          {invalidRange && (
            <p role="alert" className="text-sm text-danger">
              A data inicial deve ser anterior ou igual à final.
            </p>
          )}

          <p className="text-xs text-muted">Inclui títulos com alguma parcela no período.</p>

          {isFetching && <p className="text-sm text-muted">Atualizando {config.plural}...</p>}
          </FilterBar>

          {isError ? (
            <div className="m-4 rounded-lg border border-danger/30 p-6 text-sm text-danger sm:m-5">Não foi possível carregar as {config.plural}. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1">
              <DataTable data={data?.data ?? []} columns={columns} emptyMessage={`Nenhuma ${config.singular.toLowerCase()} encontrada`} emptyHint="Ajuste os filtros para ver outros resultados." getRowId={(item) => item.id} getRowHref={(item) => `${config.basePath}/${item.id}`} />
            </div>
          )}

          {isLoading && !data && <p className="p-4 text-sm text-muted">Carregando {config.plural}...</p>}

          {!isError && (
            <CrudPagination
              page={data?.pagination.page ?? page}
              totalPages={totalPages}
              totalItems={data?.pagination.total ?? 0}
              onPrevious={() => setPage(Math.max(1, page - 1))}
              onNext={() => setPage(Math.min(totalPages, page + 1))}
            />
          )}
        </div>
      </Section>
    </Page>
  );
}
