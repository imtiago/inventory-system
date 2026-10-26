import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { CrudPagination } from '@/shared/components/crud';
import { StatusBadge } from '@/components/ui/badge';
import { FilterBar, FILTER_FIELD, FILTER_GRID, FILTER_LABEL } from '@/shared/components/layout/FilterBar';
import { Section } from '@/shared/components/details/Section';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Page } from '@/shared/components/layout/Page';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { useDiscardNfeImport, useNfeImports, useUploadNfeImport } from '../hooks/useNfeImports';
import { NFE_STATUS_LABELS, type INfeImportSummary, type NfeImportStatus } from '../types';
import { LoadingState } from '@/shared/components/LoadingState';

const STATUSES = Object.keys(NFE_STATUS_LABELS) as NfeImportStatus[];

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
    { id: 'total', header: 'Total', mobile: 'meta', numeric: true, cell: (item) => formatCurrency(item.totalAmount) },
    { id: 'status', header: 'Status', mobile: 'meta', cell: (item) => <StatusBadge status={item.status}>{NFE_STATUS_LABELS[item.status] ?? item.status}</StatusBadge> },
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
            <button type="button" onClick={() => setToDiscard(item)} className="text-danger hover:underline">
              Descartar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Link to={`/nfe-imports/${item.id}`} className="font-medium hover:underline">
              Ver nota
            </Link>
            {item.purchaseId && (
              <Link to={`/purchases/${item.purchaseId}`} className="font-medium hover:underline">
                Ver pedido
              </Link>
            )}
          </div>
        ),
    },
  ];

  return (
    <Page>
      <PageHeader
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
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <Upload size={18} />
              {upload.isPending ? 'Enviando...' : 'Enviar XML'}
            </button>
          </>
        }
      />

      <Section>
        <div className="flex flex-1 flex-col">
          <FilterBar>
          {feedback && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              <p>{feedback.message}</p>
              {feedback.purchaseId && (
                <Link to={`/purchases/${feedback.purchaseId}`} className="mt-1 inline-block font-medium underline">
                  Ver pedido
                </Link>
              )}
            </div>
          )}
          {discardError && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              {discardError}
            </div>
          )}

          <div className={FILTER_GRID}>
          <div>
            <label htmlFor="nfe-status" className={FILTER_LABEL}>
              Status
            </label>
            <select
              id="nfe-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as NfeImportStatus | '');
                setPage(1);
              }}
              className={FILTER_FIELD}
            >
              <option value="">Todos</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {NFE_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          </div>
          </FilterBar>

          {isError ? (
            <div className="m-4 rounded-lg border border-danger/30 p-6 text-sm text-danger sm:m-5">Não foi possível carregar as importações. Verifique sua conexão e tente novamente.</div>
          ) : (
            <div className="flex-1">
              <DataTable data={data?.data ?? []} columns={columns} emptyMessage="Nenhuma nota importada" emptyHint="Envie um XML de NF-e para começar." getRowId={(item) => item.id} />
            </div>
          )}

          {isLoading && !data && <LoadingState label="Carregando importações..." />}

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
