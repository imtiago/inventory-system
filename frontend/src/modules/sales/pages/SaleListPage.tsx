import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CrudPagination } from '@/shared/components/crud';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { DataTable } from '@/shared/components/table';

import { useSales } from '../hooks/useSales';
import { useSaleColumns } from '../hooks/useSaleColumns';

export function SaleListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError } = useSales(page);

  const columns = useSaleColumns();

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <Page>
      <Section
        title={`Vendas (${data?.pagination.total ?? 0})`}
        actions={
          <Link to="/sales/new" className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white">
            <Plus size={18} />
            Nova Venda
          </Link>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
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
