import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { CrudBadge, CrudPagination } from '@/shared/components/crud';
import { Section } from '@/shared/components/details/Section';
import { ExportButton } from '@/shared/components/export/ExportButton';
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
    <div data-testid={`summary-${id}`} className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
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
    cell: (item) => partyOf(kind, item)?.name ?? '—',
  },
  {
    id: 'origin',
    header: config.originColumn,
    cell: (item) =>
      item.originType === config.originType ? (
        <Link to={config.originHref(item)} className="hover:underline">
          {config.originText(item)}
        </Link>
      ) : (
        item.originType
      ),
  },
  { id: 'total', header: 'Total', align: 'center', cell: (item) => formatCurrency(item.totalAmount) },
  { id: 'paid', header: 'Pago', align: 'center', cell: (item) => formatCurrency(item.paidAmount) },
  { id: 'remaining', header: 'Saldo', align: 'center', cell: (item) => formatCurrency(item.remainingAmount) },
  { id: 'nextDueDate', header: 'Próx. vencimento', align: 'center', cell: (item) => formatDateOnly(item.nextDueDate) },
  {
    id: 'status',
    header: 'Status',
    align: 'center',
    cell: (item) => <CrudBadge>{FINANCE_STATUS_LABELS[item.displayStatus] ?? item.displayStatus}</CrudBadge>,
  },
  {
    id: 'actions',
    header: '',
    align: 'center',
    cell: (item) => (
      <Link to={`${config.basePath}/${item.id}`} className="text-sm font-medium hover:underline">
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
  const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <Page>
      <Section
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
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard id="open" label="A vencer" value={data?.summary.openAmount} />
            <SummaryCard id="overdue" label="Vencido" value={data?.summary.overdueAmount} />
            <SummaryCard id={config.summaryId} label={config.summaryLabel} value={summaryValue(kind, data?.summary)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={`${kind}-status`} className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select id={`${kind}-status`} value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className={inputClass}>
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
              <label htmlFor={`${kind}-due-from`} className="mb-2 block text-sm font-medium text-gray-700">
                Vencimento de
              </label>
              <input id={`${kind}-due-from`} type="date" value={filters.dueFrom ?? ''} max={filters.dueTo} onChange={(e) => setFilter('dueFrom', e.target.value)} className={inputClass} />
            </div>

            <div>
              <label htmlFor={`${kind}-due-to`} className="mb-2 block text-sm font-medium text-gray-700">
                Vencimento até
              </label>
              <input id={`${kind}-due-to`} type="date" value={filters.dueTo ?? ''} min={filters.dueFrom} onChange={(e) => setFilter('dueTo', e.target.value)} className={inputClass} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={Boolean(filters.openOnly)} onChange={(e) => setFilter('openOnly', e.target.checked ? 'true' : null)} />
            Somente com saldo
          </label>

          {invalidRange && (
            <p role="alert" className="text-sm text-red-600">
              A data inicial deve ser anterior ou igual à final.
            </p>
          )}

          <p className="text-xs text-gray-500">Inclui títulos com alguma parcela no período.</p>

          {isFetching && <p className="text-sm text-gray-500">Atualizando {config.plural}...</p>}

          {isError ? (
            <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">Não foi possível carregar as {config.plural}. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(item) => item.id} />
            </div>
          )}

          {isLoading && !data && <p className="text-sm text-gray-500">Carregando {config.plural}...</p>}

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
