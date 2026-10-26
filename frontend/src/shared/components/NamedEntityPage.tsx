import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';

import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Page } from '@/shared/components/layout/Page';
import { Section } from '@/shared/components/details/Section';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { CrudPagination } from '@/shared/components/crud';
import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Can } from '@/shared/auth/Can';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useCrudMutation } from '@/shared/react-query/useCrudMutation';
import { queryKeys } from '@/shared/react-query/keys';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import type { ListParams, Paginated } from '@/shared/types/pagination';

export interface NamedEntity {
  id: string;
  name: string;
  productsCount?: number;
}

interface Props<T extends NamedEntity> {
  /** Feminine nouns (marca, categoria): "Nova marca". */
  singular: string;
  plural: string;
  /** Root query key of the entity (queryKeys.brands / queryKeys.categories). */
  queryKey: readonly string[];
  existsCode: string;
  list: (params: ListParams) => Promise<Paginated<T>>;
  create: (input: { name: string }) => Promise<T>;
  update: (id: string, input: { name: string }) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

const PAGE_SIZE = 10;
const inputClass = 'w-full rounded-lg border border-input bg-surface p-3 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted';

/** Generic list + create/rename modal + delete confirmation for brand-like entities (name + productsCount). */
export function NamedEntityPage<T extends NamedEntity>({ singular, plural, queryKey, existsCode, list, create, update, remove }: Props<T>) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  const Plural = plural[0].toUpperCase() + plural.slice(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: [...queryKey, 'list', page, debouncedSearch],
    queryFn: () => list({ page, limit: PAGE_SIZE, search: debouncedSearch }),
    placeholderData: keepPreviousData,
  });

  // Product lists show brand/category names, so they are refreshed as well.
  const invalidateKeys = [queryKey, queryKeys.products];

  const createMutation = useCrudMutation({ mutationFn: create, invalidateKeys, successMessage: `${capitalize(singular)} criada.`, silentError: true });
  const updateMutation = useCrudMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => update(id, { name }),
    invalidateKeys,
    successMessage: `${capitalize(singular)} atualizada.`,
    silentError: true,
  });
  const deleteMutation = useCrudMutation({ mutationFn: remove, invalidateKeys, successMessage: `${capitalize(singular)} excluída.`, errorMessage: `Erro ao excluir ${singular}.` });

  const columns: DataTableColumn<T>[] = [
    { id: 'name', header: 'Nome', mobile: 'title', cell: (item) => item.name },
    { id: 'productsCount', header: 'Produtos', mobile: 'meta', numeric: true, cell: (item) => item.productsCount ?? 0 },
    {
      id: 'actions',
      header: 'Ações',
      mobile: 'actions',
      align: 'center',
      cell: (item) => (
        <div className="flex justify-center gap-1">
          <Can permission="catalog.write">
            <button
              type="button"
              onClick={() => {
                setEditing(item);
                setFormOpen(true);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-surface-muted hover:text-primary-hover"
              aria-label={`Editar ${item.name}`}
            >
              <Pencil size={18} />
            </button>
          </Can>
          <Can permission="catalog.delete">
            <button type="button" onClick={() => setDeleting(item)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-danger hover:bg-surface-muted" aria-label={`Excluir ${item.name}`}>
              <Trash2 size={18} />
            </button>
          </Can>
        </div>
      ),
    },
  ];

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;

    try {
      await deleteMutation.mutateAsync(deleting.id);
      if (page > 1 && (data?.data.length ?? 0) === 1) setPage(page - 1);
    } catch {
      // The mutation already showed the error toast (e.g. *_IN_USE).
    }

    setDeleting(null);
  }

  return (
    <Page>
      <PageHeader
        title={Plural}
        description={`Gerencie as ${plural} do catálogo.`}
        actions={
          <Can permission="catalog.write">
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover"
            >
              <Plus size={18} />
              Nova {singular}
            </Button>
          </Can>
        }
      />

      <Section>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted">Total de {plural}</p>
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
                placeholder={`Buscar ${plural}...`}
                aria-label={`Buscar ${plural}`}
                className="w-full rounded-lg border border-input bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-subtle focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>

          <div className="flex-1">
            {isError ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="font-medium text-danger">Não foi possível carregar as {plural}.</p>
                <p className="text-sm text-muted">Verifique sua conexão e tente novamente.</p>
              </div>
            ) : isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted">
                <LoaderCircle size={20} className="animate-spin" />
                Carregando {plural}...
              </div>
            ) : (
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(item) => item.id} emptyMessage={`Nenhuma ${singular} encontrada`} emptyHint="Tente outra busca ou cadastre uma nova." />
            )}
          </div>

          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 border-t border-border px-5 py-2 text-xs text-muted">
              <LoaderCircle size={14} className="animate-spin" />
              Atualizando resultados...
            </div>
          )}

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

      <Modal open={formOpen} onClose={closeForm} title={editing ? `Editar ${singular}` : `Nova ${singular}`} description={`Informe o nome da ${singular}.`}>
        <NameForm
          key={editing?.id ?? 'new'}
          initialName={editing?.name ?? ''}
          existsCode={existsCode}
          onCancel={closeForm}
          onSubmit={async (name) => {
            if (editing) await updateMutation.mutateAsync({ id: editing.id, name });
            else await createMutation.mutateAsync({ name });
            closeForm();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir ${singular}`}
        description={`Deseja realmente excluir ${deleting ? `"${deleting.name}"` : `a ${singular}`}? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </Page>
  );
}

function capitalize(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}

interface NameFormProps {
  initialName: string;
  existsCode: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}

function NameForm({ initialName, existsCode, onSubmit, onCancel }: NameFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ name: string }>({ defaultValues: { name: initialName } });

  const once = useSingleSubmit();
  useModalBusy(isSubmitting);

  const submit = handleSubmit(once(async ({ name }) => {
    try {
      await onSubmit(name.trim());
    } catch (error) {
      if (applySubmitError(setError, error, ['name'])) return;

      const { code, message } = parseApiErrorSync(error);
      setError(code === existsCode ? 'name' : 'root.server', { type: 'server', message });
    }
  }));

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="named-entity-name" className="mb-1 block font-medium">
          Nome *
        </label>
        <input
          id="named-entity-name"
          type="text"
          maxLength={80}
          autoComplete="off"
          className={inputClass}
          {...register('name', { validate: (value) => value.trim().length > 0 || 'Informe o nome.' })}
        />
        {errors.name && <p className="mt-1 text-sm text-danger">{errors.name.message}</p>}
      </div>

      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} className="rounded-lg border px-5 py-3 hover:bg-surface-muted">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          Salvar
        </button>
      </div>
    </form>
  );
}
