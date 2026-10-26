import { useState } from 'react';
import { LoaderCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';

import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Page } from '@/shared/components/layout/Page';
import { Section } from '@/shared/components/details/Section';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { CrudPagination } from '@/shared/components/crud';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Can } from '@/shared/auth/Can';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatPhone } from '@/shared/utils/formatPhone';

import { useSuppliers } from '../hooks/useSuppliers';
import { useDeleteSupplier } from '../hooks/useSupplierMutations';
import { SupplierCreateModal, SupplierEditModal } from '../components/SupplierFormModals';
import { maskDocument } from '../utils/formatDocument';
import type { ISupplier } from '../types';

export function SupplierListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ISupplier | null>(null);
  const [deleting, setDeleting] = useState<ISupplier | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isFetching, isError } = useSuppliers(page, debouncedSearch);
  const deleteMutation = useDeleteSupplier();

  function handleConfirmDelete() {
    if (!deleting) return;

    setDeleteError(null);
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => setDeleting(null),
      onError: (error) => {
        const parsed = parseApiErrorSync(error);

        // The axios interceptor already redirects to /login on 401.
        if (parsed.status === 401) return;

        setDeleteError(parsed.code === 'UNKNOWN_ERROR' ? 'Não foi possível excluir o fornecedor.' : parsed.message);
        setDeleting(null);
      },
    });
  }

  const columns: DataTableColumn<ISupplier>[] = [
    { id: 'name', header: 'Nome', mobile: 'title', cell: (item) => item.name },
    { id: 'document', header: 'Documento', mobile: 'subtitle', cell: (item) => maskDocument(item.document) },
    { id: 'email', header: 'E-mail', mobile: 'meta', cell: (item) => item.email ?? '-' },
    { id: 'phone', header: 'Telefone', mobile: 'meta', cell: (item) => formatPhone(item.phone) },
    {
      id: 'actions',
      header: 'Ações',
      mobile: 'actions',
      align: 'center',
      cell: (item) => (
        <Can permission="purchases.write">
          <div className="flex justify-center gap-1">
            <button type="button" onClick={() => setEditing(item)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:text-primary-hover" aria-label={`Editar ${item.name}`}>
              <Pencil size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeleting(item);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-danger hover:bg-surface-muted"
              aria-label={`Excluir ${item.name}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </Can>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Fornecedores"
        description="Gerencie os fornecedores cadastrados."
        actions={
          <Can permission="purchases.write">
            <Button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover">
              <Plus size={18} />
              Novo fornecedor
            </Button>
          </Can>
        }
      />

      <Section>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted">Total de fornecedores</p>
              <p className="text-xl font-bold text-foreground">{data?.pagination.total ?? 0}</p>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nome, documento ou e-mail..."
                aria-label="Buscar fornecedores"
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-subtle focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>

          {deleteError && (
            <div role="alert" className="m-4 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              {deleteError}
            </div>
          )}

          <div className="flex-1">
            {isError ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="font-medium text-danger">Não foi possível carregar os fornecedores.</p>
                <p className="text-sm text-muted">Verifique sua conexão e tente novamente.</p>
              </div>
            ) : isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted">
                <LoaderCircle size={20} className="animate-spin" />
                Carregando fornecedores...
              </div>
            ) : (
              <DataTable data={data?.data ?? []} columns={columns} emptyMessage="Nenhum fornecedor encontrado" emptyHint="Tente novamente ou cadastre um novo fornecedor." getRowId={(item) => item.id} />
            )}
          </div>

          {isFetching && !isLoading && <div className="border-t border-border px-5 py-2 text-xs text-muted">Atualizando resultados...</div>}

          <div className="shrink-0">
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

      <SupplierCreateModal open={creating} onClose={() => setCreating(false)} />
      <SupplierEditModal supplier={editing} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir fornecedor"
        description={`Deseja excluir "${deleting?.name ?? ''}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </Page>
  );
}
