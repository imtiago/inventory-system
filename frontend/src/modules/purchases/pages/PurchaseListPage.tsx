import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { CrudBadge, CrudPagination } from '@/shared/components/crud';
import { Autocomplete } from '@/shared/components/form';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { Can } from '@/shared/auth/Can';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { useSupplierSearch } from '@/modules/suppliers/hooks/useSuppliers';
import type { ISupplier } from '@/modules/suppliers/types';

import { usePurchases } from '../hooks/usePurchases';
import { PURCHASE_STATUS_LABELS, type IPurchaseListItem, type PurchaseStatus } from '../types';

const STATUSES = Object.keys(PURCHASE_STATUS_LABELS) as PurchaseStatus[];
const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const columns: DataTableColumn<IPurchaseListItem>[] = [
  {
    id: 'code',
    header: 'Código',
    cell: (item) => (
      <Link to={`/purchases/${item.id}`} className="font-medium hover:underline">
        {item.code}
      </Link>
    ),
  },
  { id: 'supplier', header: 'Fornecedor', cell: (item) => item.supplier.name },
  { id: 'date', header: 'Data', align: 'center', cell: (item) => formatDateOnly(item.purchaseDate) },
  { id: 'total', header: 'Total', align: 'center', cell: (item) => formatCurrency(item.totalAmount) },
  { id: 'progress', header: 'Recebimento', align: 'center', cell: (item) => `${item.receivedPercent}%` },
  { id: 'status', header: 'Status', align: 'center', cell: (item) => <CrudBadge>{PURCHASE_STATUS_LABELS[item.status] ?? item.status}</CrudBadge> },
];

export function PurchaseListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PurchaseStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [codeSearch, setCodeSearch] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<ISupplier | null>(null);

  const search = useDebouncedValue(codeSearch.trim(), 300);
  const invalidRange = Boolean(from && to && from > to);

  const { data, isLoading, isFetching, isError } = usePurchases(
    page,
    { status: status || undefined, supplierId: supplierId ?? undefined, from: from || undefined, to: to || undefined, search: search || undefined },
    !invalidRange,
  );
  const { data: supplierData, isFetching: suppliersLoading } = useSupplierSearch(supplierQuery);

  const suppliers = supplierData?.data ?? [];
  const supplierOptions = selectedSupplier && !suppliers.some((s) => s.id === selectedSupplier.id) ? [selectedSupplier, ...suppliers] : suppliers;
  const totalPages = data?.pagination.totalPages ?? 1;

  function filter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <Page>
      <Section
        title={`Pedidos de compra (${data?.pagination.total ?? 0})`}
        actions={
          <Can permission="purchases.write">
            <Link to="/purchases/new" className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800">
              <Plus size={18} />
              Novo pedido
            </Link>
          </Can>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label htmlFor="purchase-status" className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select id="purchase-status" value={status} onChange={(e) => filter(setStatus)(e.target.value as PurchaseStatus | '')} className={inputClass}>
                <option value="">Todos</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {PURCHASE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <Autocomplete<ISupplier, string>
              label="Fornecedor"
              placeholder="Todos os fornecedores"
              options={supplierOptions}
              value={supplierId}
              getOptionValue={(supplier) => supplier.id}
              getOptionLabel={(supplier) => supplier.name}
              onSearchChange={setSupplierQuery}
              onChange={(value, option) => {
                setSelectedSupplier(option);
                filter(setSupplierId)(value);
              }}
              minSearchLength={2}
              loading={suppliersLoading}
              emptyMessage="Nenhum fornecedor encontrado."
            />

            <div>
              <label htmlFor="purchase-from" className="mb-2 block text-sm font-medium text-gray-700">
                Data de
              </label>
              <input id="purchase-from" type="date" value={from} max={to || undefined} onChange={(e) => filter(setFrom)(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label htmlFor="purchase-to" className="mb-2 block text-sm font-medium text-gray-700">
                Data até
              </label>
              <input id="purchase-to" type="date" value={to} min={from || undefined} onChange={(e) => filter(setTo)(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label htmlFor="purchase-search" className="mb-2 block text-sm font-medium text-gray-700">
                Buscar por código
              </label>
              <input id="purchase-search" type="search" value={codeSearch} placeholder="PC000012" onChange={(e) => filter(setCodeSearch)(e.target.value)} className={inputClass} />
            </div>
          </div>

          {invalidRange && (
            <p role="alert" className="text-sm text-red-600">
              A data inicial deve ser anterior ou igual à final.
            </p>
          )}

          {isFetching && <p className="text-sm text-gray-500">Atualizando pedidos...</p>}

          {isError ? (
            <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">Não foi possível carregar os pedidos. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(item) => item.id} />
            </div>
          )}

          {isLoading && !data && <p className="text-sm text-gray-500">Carregando pedidos...</p>}

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
