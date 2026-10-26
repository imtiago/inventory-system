import { useState } from 'react';

import { CrudPagination } from '@/shared/components/crud';

import { DataTable } from '@/shared/components/table';

import { useInventory } from '../hooks/useInventory.ts';
import { useInventoryColumns } from '../hooks/useInventoryColumns.tsx';
import { Section } from '@/shared/components/details/Section';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Page } from '@/shared/components/layout/Page';
import { ExportButton } from '@/shared/components/export/ExportButton';
import { ExportMenu } from '@/shared/components/export/ExportMenu';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { Can } from '@/shared/auth/Can';

export function InventoryListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useInventory(page);

  const columns = useInventoryColumns();

  const hasData = data !== undefined;
  const items = data?.data ?? [];

  return (
    <Page>
      <PageHeader
        title="Estoque"
        description={isError && !hasData ? undefined : `${data?.pagination.total ?? 0} ${data?.pagination.total === 1 ? 'item' : 'itens'} em estoque`}
        actions={
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <ExportMenu>
              <ExportButton permission="inventory.read" url="/reports/stock.csv" params={{}} fallbackName={`estoque-${todayInBusinessTz()}.csv`} />
            </ExportMenu>
            <Can permission="catalog.write">
              <Link to={`/products/new`} className="flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground">
                <Plus size={18} />
                Novo
              </Link>
            </Can>
            <Can permission="inventory.write">
              <Link to={`/inventory/initial`} className="flex min-h-10 items-center gap-2 rounded-lg bg-danger-solid px-4 py-2 text-danger-foreground">
                <Plus size={18} />
                Cenário Inicial
              </Link>
            </Can>
          </div>
        }
      />

      <Section>
        <div className="flex-1">
          {isError && !hasData ? (
            <div role="alert" className="flex min-h-32 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-medium text-danger">Não foi possível carregar o estoque.</p>
              <button type="button" onClick={() => void refetch()} className="rounded-lg border border-input bg-surface text-foreground px-4 py-2 hover:bg-surface-muted">
                Tentar novamente
              </button>
            </div>
          ) : isLoading ? (
            <div role="status" className="p-6 text-center text-sm text-muted">
              Carregando estoque...
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">Nenhum item em estoque.</div>
          ) : (
            <DataTable data={items} columns={columns} getRowId={(item) => item.id} getRowHref={(item) => `/inventory/${item.id}`} />
          )}
        </div>

        <CrudPagination
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          totalItems={data?.pagination.total ?? 0}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(data?.pagination.totalPages ?? 1, p + 1))}
        />
      </Section>
    </Page>
  );
}
