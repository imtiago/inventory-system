import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { CrudBadge, CrudPagination } from '@/shared/components/crud';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { useDiscardNfeImport, useNfeImports, useUploadNfeImport } from '../hooks/useNfeImports';
import { NFE_STATUS_LABELS, type INfeImportSummary, type NfeImportStatus } from '../types';

const STATUSES = Object.keys(NFE_STATUS_LABELS) as NfeImportStatus[];
const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

type UploadFeedback = { message: string; purchaseId?: string };

export function NfeImportListPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<NfeImportStatus | ''>('');
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);
  const [toDiscard, setToDiscard] = useState<INfeImportSummary | null>(null);
  const [discardError, setDiscardError] = useState<string | null>(null);

  const { data, isLoading, isError } = useNfeImports(page, status || undefined);
  const upload = useUploadNfeImport();
  const discard = useDiscardNfeImport();
  const totalPages = data?.pagination.totalPages ?? 1;

  function handleFile(file: File | undefined) {
    if (!file) return;

    setFeedback(null);
    upload.mutate(file, {
      onSuccess: (note) => navigate(`/nfe-imports/${note.id}`),
      onError: (error) => {
        const { status: httpStatus, code, message, details } = parseApiErrorSync(error);

        if (httpStatus === 401) return;

        const purchaseId = code === 'NFE_ALREADY_IMPORTED' && typeof details?.purchaseId === 'string' ? details.purchaseId : undefined;

        setFeedback({ message: code === 'UNKNOWN_ERROR' ? 'Não foi possível enviar o arquivo. Tente novamente.' : message, purchaseId });
      },
    });

    // Lets the same file be picked again after a failure.
    if (fileInput.current) fileInput.current.value = '';
  }

  function confirmDiscard() {
    if (!toDiscard) return;

    setDiscardError(null);
    discard.mutate(toDiscard.id, {
      onSuccess: () => setToDiscard(null),
      onError: (error) => {
        setDiscardError(parseApiErrorSync(error).message);
        setToDiscard(null);
      },
    });
  }

  const columns: DataTableColumn<INfeImportSummary>[] = [
    { id: 'number', header: 'Número/série', mobile: 'title', cell: (item) => `${item.number}/${item.series}` },
    { id: 'supplier', header: 'Fornecedor', mobile: 'subtitle', cell: (item) => item.supplier.name },
    { id: 'issueDate', header: 'Emissão', mobile: 'meta', align: 'center', cell: (item) => formatDateOnly(item.issueDate) },
    { id: 'total', header: 'Total', mobile: 'meta', align: 'center', cell: (item) => formatCurrency(item.totalAmount) },
    { id: 'status', header: 'Status', mobile: 'meta', align: 'center', cell: (item) => <CrudBadge>{NFE_STATUS_LABELS[item.status] ?? item.status}</CrudBadge> },
    {
      id: 'actions',
      header: 'Ações',
      mobile: 'actions',
      align: 'center',
      cell: (item) =>
        item.status === 'DRAFT' ? (
          <div className="flex items-center justify-center gap-3">
            <Link to={`/nfe-imports/${item.id}`} className="font-medium hover:underline">
              Revisar
            </Link>
            <button type="button" onClick={() => setToDiscard(item)} className="text-red-600 hover:underline">
              Descartar
            </button>
          </div>
        ) : item.purchaseId ? (
          <Link to={`/purchases/${item.purchaseId}`} className="font-medium hover:underline">
            Ver pedido
          </Link>
        ) : null,
    },
  ];

  return (
    <Page>
      <Section
        title={`Importar NF-e (${data?.pagination.total ?? 0})`}
        actions={
          <>
            <input
              ref={fileInput}
              id="nfe-xml-file"
              type="file"
              accept=".xml,text/xml,application/xml"
              aria-label="Enviar XML"
              className="sr-only"
              disabled={upload.isPending}
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              <Upload size={18} />
              {upload.isPending ? 'Enviando...' : 'Enviar XML'}
            </button>
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {feedback && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>{feedback.message}</p>
              {feedback.purchaseId && (
                <Link to={`/purchases/${feedback.purchaseId}`} className="mt-1 inline-block font-medium underline">
                  Ver pedido
                </Link>
              )}
            </div>
          )}
          {discardError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {discardError}
            </div>
          )}

          <div className="max-w-xs">
            <label htmlFor="nfe-status" className="mb-2 block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="nfe-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as NfeImportStatus | '');
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">Todos</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {NFE_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          {isError ? (
            <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">Não foi possível carregar as importações. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <DataTable data={data?.data ?? []} columns={columns} emptyMessage="Nenhuma nota importada" emptyHint="Envie um XML de NF-e para começar." getRowId={(item) => item.id} />
            </div>
          )}

          {isLoading && !data && <p className="text-sm text-gray-500">Carregando importações...</p>}

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

      <ConfirmDialog
        open={toDiscard !== null}
        title="Descartar rascunho"
        description={`Descartar a nota ${toDiscard?.number ?? ''}/${toDiscard?.series ?? ''}? Os dados importados serão apagados e a nota poderá ser enviada novamente.`}
        confirmText="Descartar"
        loading={discard.isPending}
        onConfirm={confirmDiscard}
        onCancel={() => setToDiscard(null)}
      />
    </Page>
  );
}
