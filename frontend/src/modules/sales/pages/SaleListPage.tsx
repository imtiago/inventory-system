import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CrudPagination } from '@/shared/components/crud';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { DataTable } from '@/shared/components/table';
import { ExportButton } from '@/shared/components/export/ExportButton';
import { todayInBusinessTz } from '@/shared/utils/businessDate';

import { useSales } from '../hooks/useSales';
import { useSaleColumns } from '../hooks/useSaleColumns';

const DAY_MS = 86_400_000;
const MAX_PERIOD_DAYS = 366;

export function SaleListPage() {
  const [page, setPage] = useState(1);
  const today = todayInBusinessTz();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const periodTooLong = Boolean(from && to && from <= to && (Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > MAX_PERIOD_DAYS);
  const invalidPeriod = !from || !to || from > to || periodTooLong;

  const { data, isLoading, isFetching, isError } = useSales(page);

  const columns = useSaleColumns();

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <Page>
      <Section
        title={`Vendas (${data?.pagination.total ?? 0})`}
        actions={
          <div className="flex items-start gap-3">
            <ExportButton permission="sales.read" url="/reports/sales.csv" params={{ from, to }} fallbackName={`vendas-${today}.csv`} disabled={invalidPeriod} />
            <ExportButton label="Exportar itens" permission="sales.read" url="/reports/sale-items.csv" params={{ from, to }} fallbackName={`itens-vendidos-${today}.csv`} disabled={invalidPeriod} />
            <Link to="/sales/new" className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white">
              <Plus size={18} />
              Nova Venda
            </Link>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="sales-export-from" className="mb-1 block text-sm font-medium text-gray-700">
                De
              </label>
              <input id="sales-export-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="sales-export-to" className="mb-1 block text-sm font-medium text-gray-700">
                Até
              </label>
              <input id="sales-export-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            {periodTooLong && (
              <p role="alert" className="text-sm text-red-600">
                O período deve ter no máximo {MAX_PERIOD_DAYS} dias.
              </p>
            )}
            <p className="text-xs text-gray-500">Período usado na exportação (a lista mostra todas as vendas).</p>
          </div>
          {isFetching && <p className="text-sm text-gray-500">Atualizando vendas...</p>}

          {isError ? (
            <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">Não foi possível carregar as vendas. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(sale) => sale.id} />
            </div>
          )}

          {isLoading && !data && <p className="text-sm text-gray-500">Carregando vendas...</p>}

          {!isError && (
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
