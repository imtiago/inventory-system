import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CrudPagination } from '@/shared/components/crud';
import { FilterPanel } from '@/shared/components/layout/FilterPanel';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { DataTable } from '@/shared/components/table';
import { ExportButton } from '@/shared/components/export/ExportButton';
import { ExportMenu } from '@/shared/components/export/ExportMenu';
import { todayInBusinessTz } from '@/shared/utils/businessDate';

import type { SaleStatus } from '../types';
import { useSales } from '../hooks/useSales';
import { useSaleColumns } from '../hooks/useSaleColumns';

const DAY_MS = 86_400_000;
const MAX_PERIOD_DAYS = 366;

export function SaleListPage() {
  const [page, setPage] = useState(1);
  const today = todayInBusinessTz();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<SaleStatus | ''>('');
  const periodTooLong = Boolean(from && to && from <= to && (Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > MAX_PERIOD_DAYS);
  const invalidPeriod = !from || !to || from > to || periodTooLong;

  const { data: fetched, isLoading, isFetching, isError } = useSales(page, { from, to, status }, !invalidPeriod);
  // With an invalid period the query is disabled but keeps the previous rows (placeholder): do not show them.
  const data = invalidPeriod ? undefined : fetched;

  const columns = useSaleColumns();

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <Page>
      <Section
        title={`Vendas (${data?.pagination.total ?? 0})`}
        actions={
          <div className="flex flex-wrap items-start gap-3">
            <ExportMenu>
              <ExportButton permission="sales.read" url="/reports/sales.csv" params={{ from, to, status: status || undefined }} fallbackName={`vendas-${today}.csv`} disabled={invalidPeriod} />
              <ExportButton label="Exportar itens" permission="sales.read" url="/reports/sale-items.csv" params={{ from, to }} fallbackName={`itens-vendidos-${today}.csv`} disabled={invalidPeriod} />
            </ExportMenu>
            <Link to="/sales/new" className="flex min-h-11 items-center gap-2 rounded-lg bg-black px-4 py-2 text-white">
              <Plus size={18} />
              Nova Venda
            </Link>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <FilterPanel activeCount={[from, to, status].filter(Boolean).length}>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="sales-from" className="mb-1 block text-sm font-medium text-gray-700">
                De
              </label>
              <input id="sales-from" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="sales-to" className="mb-1 block text-sm font-medium text-gray-700">
                Até
              </label>
              <input id="sales-to" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            {invalidPeriod && (
              <p role="alert" className="text-sm text-red-600">
                {periodTooLong ? `O período deve ter no máximo ${MAX_PERIOD_DAYS} dias.` : !from || !to ? 'Informe o período.' : 'Período inválido: a data inicial deve ser anterior ou igual à final.'}
              </p>
            )}
            <div>
              <label htmlFor="sales-status" className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select id="sales-status" value={status} onChange={(e) => { setStatus(e.target.value as SaleStatus | ''); setPage(1); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="PENDING">Pendente</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELED">Cancelada</option>
              </select>
            </div>
          </div>
          </FilterPanel>
          {!invalidPeriod && isFetching && <p className="text-sm text-gray-500">Atualizando vendas...</p>}

          {invalidPeriod ? null : isError ? (
            <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">Não foi possível carregar as vendas. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <DataTable data={data?.data ?? []} columns={columns} emptyMessage="Nenhuma venda encontrada" emptyHint="Ajuste o período ou o status, ou registre uma nova venda." getRowId={(sale) => sale.id} getRowHref={(sale) => `/sales/${sale.id}`} />
            </div>
          )}

          {!invalidPeriod && isLoading && !data && <p className="text-sm text-gray-500">Carregando vendas...</p>}

          {!invalidPeriod && !isError && (
            <CrudPagination
              page={data?.pagination.page ?? page}
              totalPages={totalPages}
              totalItems={data?.pagination.total ?? 0}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          )}
        </div>
      </Section>
    </Page>
  );
}
