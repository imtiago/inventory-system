import { useState } from 'react';
import { KeyRound, LoaderCircle, Pencil, Plus, Search, Users } from 'lucide-react';

import { Page } from '@/shared/components/layout/Page';
import { Section } from '@/shared/components/details/Section';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { CrudPagination } from '@/shared/components/crud';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

import { useUsers } from '../hooks/useUsers';
import { UserFormModal } from '../components/UserFormModal';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { ROLE_LABELS, type UserDTO } from '../types';

export function UserListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [resetting, setResetting] = useState<UserDTO | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isFetching, isError } = useUsers(page, debouncedSearch);

  const columns: DataTableColumn<UserDTO>[] = [
    { id: 'name', header: 'Nome', mobile: 'title', cell: (user) => user.name },
    { id: 'email', header: 'E-mail', mobile: 'subtitle', cell: (user) => user.email },
    { id: 'role', header: 'Papel', mobile: 'meta', cell: (user) => ROLE_LABELS[user.role] },
    {
      id: 'status',
      header: 'Status',
      mobile: 'meta',
      cell: (user) => (
        <span className={`rounded-full px-3 py-1 text-sm ${user.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
          {user.active ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Ações',
      mobile: 'actions',
      align: 'center',
      cell: (user) => (
        <div className="flex justify-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing(user);
              setFormOpen(true);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-blue-600 hover:text-blue-800"
            aria-label={`Editar ${user.name}`}
          >
            <Pencil size={18} />
          </button>
          <button type="button" onClick={() => setResetting(user)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-amber-600 hover:text-amber-800" aria-label={`Redefinir senha de ${user.name}`}>
            <KeyRound size={18} />
          </button>
        </div>
      ),
    },
  ];

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  return (
    <Page>
      <Section
        title="Usuários"
        description="Gerencie os usuários e seus papéis de acesso."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800"
          >
            <Plus size={18} />
            Novo usuário
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100">
                <Users size={21} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total de usuários</p>
                <p className="text-xl font-bold text-gray-800">{data?.pagination.total ?? 0}</p>
              </div>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar usuários..."
                aria-label="Buscar usuários"
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {isError ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="font-medium text-red-600">Não foi possível carregar os usuários.</p>
                <p className="text-sm text-gray-500">Verifique sua conexão e tente novamente.</p>
              </div>
            ) : isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500">
                <LoaderCircle size={20} className="animate-spin" />
                Carregando usuários...
              </div>
            ) : (
              <DataTable data={data?.data ?? []} columns={columns} emptyMessage="Nenhum usuário encontrado" emptyHint="Tente novamente ou cadastre um novo usuário." getRowId={(item) => item.id} />
            )}
          </div>

          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2 text-xs text-gray-500">
              <LoaderCircle size={14} className="animate-spin" />
              Atualizando resultados...
            </div>
          )}

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

      <UserFormModal open={formOpen} user={editing} onClose={closeForm} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
    </Page>
  );
}
