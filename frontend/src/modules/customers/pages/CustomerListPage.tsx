import { useState } from 'react';
import { Plus, Search, Users, LoaderCircle } from 'lucide-react';

import { Page } from '@/shared/components/layout/Page';
import { Section } from '@/shared/components/details/Section';
import { DataTable } from '@/shared/components/table';
import { CrudPagination } from '@/shared/components/crud';
import { Modal } from '@/shared/components/Modal/Modal.tsx';
import { Button } from '@/components/ui/button.tsx';

import { useCustomers } from '../hooks/useCustomers.ts';
import { useCustomerColumns } from '../hooks/useCustomerColumns.tsx';
import { useCreateCustomer } from '../hooks/useCreateCustomer.ts';

import { CustomerForm } from '../components/CustomerForm.tsx';
import { CustomerEditModal } from '../components/CustomerEditModal';
import { Can } from '@/shared/auth/Can';

import type { ICreateCustomerDTO, ICustomer } from '../types';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue.ts';


export function CustomerListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ICustomer | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isFetching, isError } = useCustomers(page, debouncedSearch);

  const { mutateAsync, isPending: creatingCustomer } = useCreateCustomer();

  const columns = useCustomerColumns(setEditing);

  async function handleSubmitCreateCustomer(formData: ICreateCustomerDTO) {
    await mutateAsync(formData);
    setCreating(false);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function closeCreate() {
    setCreating(false);
  }

  return (
    <Page>
      <Section
        title="Clientes"
        description="Gerencie os clientes cadastrados no sistema."
        actions={
          <Can permission="customers.write">
            <Button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800">
              <Plus size={18} />
              Novo Cliente
            </Button>
          </Can>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Resumo e busca */}
          <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100">
                <Users size={21} className="text-gray-600" />
              </div>

              <div>
                <p className="text-sm text-gray-500">Total de clientes</p>

                <p className="text-xl font-bold text-gray-800">{data?.pagination.total ?? 0}</p>
              </div>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

              <input
                type="search"
                value={search}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Buscar clientes..."
                aria-label="Buscar clientes"
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>
          </div>

          {/* Tabela */}
          <div className="min-h-0 flex-1 overflow-auto">
            {isError ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="font-medium text-red-600">Não foi possível carregar os clientes.</p>

                <p className="text-sm text-gray-500">Verifique sua conexão e tente novamente.</p>
              </div>
            ) : isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500">
                <LoaderCircle size={20} className="animate-spin" />
                Carregando clientes...
              </div>
            ) : (
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(item) => item.id} getRowHref={(item) => `/customers/${item.id}`} />
            )}
          </div>

          {/* Indicador de atualização */}
          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2 text-xs text-gray-500">
              <LoaderCircle size={14} className="animate-spin" />
              Atualizando resultados...
            </div>
          )}

          {/* Paginação */}
          <div className="shrink-0 border-t border-gray-100 p-3 sm:p-4">
            <CrudPagination
              page={data?.pagination.page ?? page}
              totalPages={data?.pagination.totalPages ?? 1}
              totalItems={data?.pagination.total ?? 0}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(data?.pagination.totalPages ?? 1, current + 1))}
            />
          </div>
        </div>
      </Section>

      <Modal open={creating} onClose={closeCreate} busy={creatingCustomer} title="Cadastrar novo cliente" description="Informe os dados do cliente.">
        {creating && <CustomerForm onCancel={closeCreate} onSubmit={handleSubmitCreateCustomer} />}
      </Modal>

      <CustomerEditModal customer={editing} onClose={() => setEditing(null)} />
    </Page>
  );
}
