import { useState } from 'react';

import { CrudHeader, CrudPagination } from '@/shared/components/crud';

import { DataTable } from '@/shared/components/table';

import { useInventory } from '../hooks/useInventory.ts';
import { useInventoryColumns } from '../hooks/useInventoryColumns.tsx';
import { Section } from '@/shared/components/details/Section';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Page } from '@/shared/components/layout/Page';

export function InventoryListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useInventory(page);

  const columns = useInventoryColumns();

  return (
    <Page>
      {/* <CrudHeader
        title="Produtos"
        description="Gerencie seu catálogo"
        createPath="/products/new"
        createLabel="Novo Produto"
        loading={isFetching}
      /> */}

      <Section
        title={`Items (${data?.pagination.total})`}
        // description="Unidades comercializadas deste produto"
        actions={
          <div className="flex items-center gap-4">
            <Link to={`/products/new`} className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white">
              <Plus size={18} />
              Novo
            </Link>
            <Link to={`/inventory/initial`} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white">
              <Plus size={18} />
              Cenário Inicial
            </Link>
          </div>
        }
      >
        {' '}
        {/* Área da tabela */}
        <div className="flex-1 overflow-y-auto">
          <DataTable data={data?.data ?? []} columns={columns} getRowId={(item) => item.id} />
        </div>
        {/* Paginação fixa */}
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
