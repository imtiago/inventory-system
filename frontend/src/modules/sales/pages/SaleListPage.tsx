import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CrudPagination } from '@/shared/components/crud';
import { FilterBar, FILTER_FIELD, FILTER_GRID, FILTER_LABEL } from '@/shared/components/layout/FilterBar';
import { FilterPanel } from '@/shared/components/layout/FilterPanel';
import { Section } from '@/shared/components/details/Section';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Page } from '@/shared/components/layout/Page';
import { DataTable } from '@/shared/components/table';
import { ExportButton } from '@/shared/components/export/ExportButton';
import { ExportMenu } from '@/shared/components/export/ExportMenu';
import { todayInBusinessTz } from '@/shared/utils/businessDate';

import type { SaleStatus } from '../types';
import { useSales } from '../hooks/useSales';
import { useSaleColumns } from '../hooks/useSaleColumns';
import { LoadingState } from '@/shared/components/LoadingState';

const DAY_MS = 86_400_000;
const MAX_PERIOD_DAYS = 366;

export function SaleListPage() {
  const [page, setPage] = useState(1);
  const today = todayInBusinessTz();
  const defaultFrom = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(defaultFrom);
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
      <PageHeader
        title={`Vendas (${data?.pagination.total ?? 0})`}
        actions={
          <div className="flex flex-wrap items-start gap-3">
            <ExportMenu>
              <ExportButton permission="sales.read" url="/reports/sales.csv" params={{ from, to, status: status || undefined }} fallbackName={`vendas-${today}.csv`} disabled={invalidPeriod} />
              <ExportButton label="Exportar itens" permission="sales.read" url="/reports/sale-items.csv" params={{ from, to }} fallbackName={`itens-vendidos-${today}.csv`} disabled={invalidPeriod} />
            </ExportMenu>
            <Link to="/sales/new" className="flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground">
              <Plus size={18} />
              Nova Venda
            </Link>
          </div>
        }
      />

      <Section>
        <div className="flex flex-1 flex-col">
          <FilterBar>
          <FilterPanel activeCount={[from !== defaultFrom, to !== today, status !== ''].filter(Boolean).length}>
          <div className={FILTER_GRID}>
            <div>
              <label htmlFor="sales-from" className={FILTER_LABEL}>
                De
              </label>
              <input id="sales-from" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={FILTER_FIELD} />
            </div>
            <div>
              <label htmlFor="sales-to" className={FILTER_LABEL}>
                Até
              </label>
              <input id="sales-to" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={FILTER_FIELD} />
            </div>
            <div>
              <label htmlFor="sales-status" className={FILTER_LABEL}>
                Status
              </label>
              <select id="sales-status" value={status} onChange={(e) => { setStatus(e.target.value as SaleStatus | ''); setPage(1); }} className={FILTER_FIELD}>
                <option value="">Todos</option>
                <option value="PENDING">Pendente</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELED">Cancelada</option>
              </select>
            </div>
          </div>
          </FilterPanel>
          {invalidPeriod && (
            <p role="alert" className="text-sm text-danger">
              {periodTooLong ? `O período deve ter no máximo ${MAX_PERIOD_DAYS} dias.` : !from || !to ? 'Informe o período.' : 'Período inválido: a data inicial deve ser anterior ou igual à final.'}
            </p>
          )}
          {!invalidPeriod && isFetching && <p className="text-sm text-muted">Atualizando vendas...</p>}
          </FilterBar>

          {invalidPeriod ? null : isError ? (
            <div className="m-4 rounded-lg border border-danger/30 p-6 text-sm text-danger sm:m-5">Não foi possível carregar as vendas. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1">
              <DataTable data={data?.data ?? []} columns={columns} emptyMessage="Nenhuma venda encontrada" emptyHint="Ajuste o período ou o status, ou registre uma nova venda." getRowId={(sale) => sale.id} getRowHref={(sale) => `/sales/${sale.id}`} />
            </div>
          )}

          {!invalidPeriod && isLoading && !data && <LoadingState label="Carregando vendas..." />}

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
