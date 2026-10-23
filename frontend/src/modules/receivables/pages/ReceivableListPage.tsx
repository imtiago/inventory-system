import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { CrudBadge, CrudPagination } from '@/shared/components/crud';
import { Autocomplete } from '@/shared/components/form';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { useCustomer } from '@/modules/customers/hooks/useCustomer';
import { useCustomerSearch } from '@/modules/customers/hooks/useCustomerSearch';
import type { ICustomer } from '@/modules/customers/types';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { useReceivables } from '../hooks/useReceivables';
import { RECEIVABLE_STATUS_LABELS, type IReceivableFilters, type IReceivableListItem, type ReceivableStatus } from '../types';

const STATUSES = Object.keys(RECEIVABLE_STATUS_LABELS) as ReceivableStatus[];

type FilterKey = 'status' | 'customerId' | 'dueFrom' | 'dueTo';

function SummaryCard({ id, label, value }: { id: string; label: string; value?: number }) {
  return (
    <div data-testid={`summary-${id}`} className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{formatCurrency(value ?? 0)}</p>
    </div>
  );
}

const columns: DataTableColumn<IReceivableListItem>[] = [
  {
    id: 'customer',
    header: 'Cliente',
    cell: (item) => item.customer.name,
  },
  {
    id: 'origin',
    header: 'Origem',
    cell: (item) =>
      item.originType === 'SALE' ? (
        <Link to={`/sales/${item.originId}`} className="hover:underline">
          Venda #{item.originId.slice(0, 8).toUpperCase()}
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
    cell: (item) => <CrudBadge>{RECEIVABLE_STATUS_LABELS[item.displayStatus] ?? item.displayStatus}</CrudBadge>,
  },
  {
    id: 'actions',
    header: '',
    align: 'center',
    cell: (item) => (
      <Link to={`/receivables/${item.id}`} className="text-sm font-medium hover:underline">
        Ver conta
      </Link>
    ),
  },
];

export function ReceivableListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(null);

  const rawStatus = searchParams.get('status');
  const filters: IReceivableFilters = {
    status: STATUSES.includes(rawStatus as ReceivableStatus) ? (rawStatus as ReceivableStatus) : undefined,
    customerId: searchParams.get('customerId') || undefined,
    dueFrom: searchParams.get('dueFrom') || undefined,
    dueTo: searchParams.get('dueTo') || undefined,
  };
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const invalidRange = Boolean(filters.dueFrom && filters.dueTo && filters.dueFrom > filters.dueTo);
  const { data, isLoading, isFetching, isError } = useReceivables(page, filters, !invalidRange);
  const { data: urlCustomer } = useCustomer(filters.customerId ?? '');
  const { data: customerData, isFetching: customersLoading } = useCustomerSearch(customerSearch);

  const customers = customerData?.data ?? [];
  const knownCustomer = selectedCustomer?.id === filters.customerId ? selectedCustomer : urlCustomer?.id === filters.customerId ? urlCustomer : null;
  const customerOptions = knownCustomer && !customers.some((c) => c.id === knownCustomer.id) ? [knownCustomer, ...customers] : customers;

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
      <Section title={`Contas a receber (${data?.pagination.total ?? 0})`}>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard id="open" label="A vencer" value={data?.summary.openAmount} />
            <SummaryCard id="overdue" label="Vencido" value={data?.summary.overdueAmount} />
            <SummaryCard id="received" label="Recebido" value={data?.summary.receivedAmount} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="receivable-status" className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select id="receivable-status" value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className={inputClass}>
                <option value="">Todos</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {RECEIVABLE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <Autocomplete<ICustomer, string>
              label="Cliente"
              placeholder="Todos os clientes"
              options={customerOptions}
              value={filters.customerId ?? null}
              getOptionValue={(customer) => customer.id}
              getOptionLabel={(customer) => customer.name}
              getOptionDescription={(customer) => [customer.email, customer.phone].filter(Boolean).join(' · ')}
              onSearchChange={setCustomerSearch}
              onChange={(value, option) => {
                setSelectedCustomer(option);
                setFilter('customerId', value);
              }}
              minSearchLength={2}
              loading={customersLoading}
              emptyMessage="Nenhum cliente encontrado."
            />

            <div>
              <label htmlFor="receivable-due-from" className="mb-2 block text-sm font-medium text-gray-700">
                Vencimento de
              </label>
              <input id="receivable-due-from" type="date" value={filters.dueFrom ?? ''} max={filters.dueTo} onChange={(e) => setFilter('dueFrom', e.target.value)} className={inputClass} />
            </div>

            <div>
              <label htmlFor="receivable-due-to" className="mb-2 block text-sm font-medium text-gray-700">
                Vencimento até
              </label>
              <input id="receivable-due-to" type="date" value={filters.dueTo ?? ''} min={filters.dueFrom} onChange={(e) => setFilter('dueTo', e.target.value)} className={inputClass} />
            </div>
          </div>

          {invalidRange && (
            <p role="alert" className="text-sm text-red-600">
              A data inicial deve ser anterior ou igual à final.
            </p>
          )}

          <p className="text-xs text-gray-500">Inclui títulos com alguma parcela no período.</p>

          {isFetching && <p className="text-sm text-gray-500">Atualizando contas a receber...</p>}

          {isError ? (
            <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">Não foi possível carregar as contas a receber. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(item) => item.id} />
            </div>
          )}

          {isLoading && !data && <p className="text-sm text-gray-500">Carregando contas a receber...</p>}

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
