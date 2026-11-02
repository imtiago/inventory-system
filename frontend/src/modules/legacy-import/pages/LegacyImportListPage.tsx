import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, PenLine, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { CrudPagination } from '@/shared/components/crud';
import { Section } from '@/shared/components/details/Section';
import { LoadingState } from '@/shared/components/LoadingState';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { parseApiError, parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatDateTime } from '@/shared/utils/formatDateTime';
import { formatCurrency } from '@/shared/utils/money';

import { LegacyImportSteps } from '../components/LegacyImportSteps';
import { useDeleteLegacyBatch, useLegacyBatches, useUploadLegacyCsv } from '../hooks/useLegacyImports';
import { downloadLegacyTemplate } from '../services/legacyImportService';
import { LEGACY_BATCH_STATUS_LABELS, batchLabel, type LegacyBatchListItem } from '../types';
import { plural } from '../utils/plural';

const actionClass = 'min-h-11';

/** Lista de lotes do caderninho e o roteiro: baixar modelo → enviar planilha ou lançamento rápido → revisar → confirmar. */
export function LegacyImportListPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [toDelete, setToDelete] = useState<LegacyBatchListItem | null>(null);

  const { data, isLoading, isError } = useLegacyBatches(page);
  const upload = useUploadLegacyCsv();
  const remove = useDeleteLegacyBatch();
  const totalPages = data?.pagination.totalPages ?? 1;

  async function downloadTemplate() {
    setFeedback(null);
    setDownloading(true);
    try {
      await downloadLegacyTemplate();
    } catch (error) {
      setFeedback((await parseApiError(error)).message);
    } finally {
      setDownloading(false);
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFeedback(null);
    upload.mutate(file, {
      onSuccess: (batch) => navigate(`/finance/legacy-imports/${batch.id}`),
      onError: (error) => {
        const parsed = parseApiErrorSync(error);
        if (parsed.status === 401) return;
        setFeedback(parsed.code === 'UNKNOWN_ERROR' ? 'Não foi possível enviar a planilha. Tente novamente.' : parsed.message);
      },
    });
    // Permite escolher o mesmo arquivo de novo depois de um erro.
    if (fileInput.current) fileInput.current.value = '';
  }

  function confirmDelete() {
    if (!toDelete) return;
    setFeedback(null);
    remove.mutate(toDelete.id, {
      onSuccess: () => setToDelete(null),
      onError: (error) => {
        setFeedback(parseApiErrorSync(error).message);
        setToDelete(null);
      },
    });
  }

  const columns: DataTableColumn<LegacyBatchListItem>[] = [
    { id: 'batch', header: 'Lote', mobile: 'title', cell: (item) => <span className="break-words font-medium">{batchLabel(item)}</span> },
    {
      id: 'summary',
      header: 'Resumo',
      mobile: 'subtitle',
      cell: (item) => `${plural(item.summary.rows, 'linha', 'linhas')} · ${plural(item.summary.newCustomers, 'novo', 'novos')} · ${plural(item.summary.existingCustomers, 'existente', 'existentes')}`,
    },
    { id: 'status', header: 'Situação', mobile: 'meta', cell: (item) => <StatusBadge status={item.status}>{LEGACY_BATCH_STATUS_LABELS[item.status] ?? item.status}</StatusBadge> },
    { id: 'open', header: 'Em aberto', mobile: 'meta', numeric: true, cell: (item) => formatCurrency(item.summary.openTotal) },
    {
      id: 'issues',
      header: 'Avisos/erros',
      mobile: 'meta',
      cell: (item) =>
        item.summary.warnings === 0 && item.summary.errors === 0 ? (
          <span className="text-muted">Nenhum</span>
        ) : (
          <span className="flex flex-wrap gap-x-2">
            {item.summary.warnings > 0 && <span className="text-warning">{plural(item.summary.warnings, 'aviso', 'avisos')}</span>}
            {item.summary.errors > 0 && <span className="text-danger">{plural(item.summary.errors, 'erro', 'erros')}</span>}
          </span>
        ),
    },
    { id: 'created', header: 'Criado por', mobile: 'meta', cell: (item) => `${item.createdBy?.name ?? '—'} · ${formatDateTime(item.createdAt)}` },
    {
      id: 'actions',
      header: 'Ações',
      mobile: 'actions',
      align: 'center',
      cell: (item) => (
        <div className="flex items-center justify-center gap-3">
          <Link to={`/finance/legacy-imports/${item.id}`} className="font-medium hover:underline">
            {item.status === 'DRAFT' ? 'Revisar' : 'Ver lote'}
          </Link>
          {item.status === 'DRAFT' && (
            <button type="button" onClick={() => setToDelete(item)} className="text-danger hover:underline">
              Excluir
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Migração do caderninho" description="Traga as dívidas antigas do caderno para o sistema. Nada é gravado antes da sua conferência." />

      <Section title="Como funciona">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <LegacyImportSteps
            actions={[
              <Button key="template" type="button" variant="outline" className={actionClass} disabled={downloading} onClick={downloadTemplate}>
                <Download size={16} aria-hidden="true" />
                {downloading ? 'Baixando...' : 'Baixar modelo'}
              </Button>,
              <div key="send" className="flex flex-wrap gap-2">
                <input
                  ref={fileInput}
                  id="legacy-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="Enviar planilha"
                  className="sr-only"
                  disabled={upload.isPending}
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <Button type="button" className={actionClass} disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
                  <Upload size={16} aria-hidden="true" />
                  {upload.isPending ? 'Enviando...' : 'Enviar planilha'}
                </Button>
                <Link
                  to="/finance/legacy-imports/quick"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-input bg-surface px-4 py-2 text-foreground hover:bg-surface-muted"
                >
                  <PenLine size={16} aria-hidden="true" />
                  Lançamento rápido
                </Link>
              </div>,
            ]}
          />

          {feedback && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              {feedback}
            </div>
          )}

          <div className="rounded-xl border border-border p-4 text-sm">
            <h3 className="font-medium text-foreground">Formatos aceitos na planilha</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>Arquivo .csv de até 1 MB (2.000 linhas), com separador &quot;;&quot; ou &quot;,&quot;. O Excel e o Google Sheets salvam assim em &quot;Salvar como&quot; / &quot;Fazer download&quot; → CSV.</li>
              <li>Valores com vírgula (1.234,56) e datas dd/mm/aaaa.</li>
              <li>
                Colunas: <strong className="text-foreground">nome</strong> e <strong className="text-foreground">valor_total</strong> (obrigatórias), celular, data_compra, descricao, valor_pago, vencimentos (ex.: &quot;10/11/2026=500,00; 10/12/2026=500,00&quot;), perfil (Novo, Regular, Bom ou Excelente) e observacao.
              </li>
              <li>Fotos do caderno: o Claude pode transcrever as páginas para o modelo; depois é só enviar e revisar aqui.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Lotes">
        <div className="flex flex-1 flex-col">
          {isError ? (
            <div className="m-4 rounded-lg border border-danger/30 p-6 text-sm text-danger sm:m-5">Não foi possível carregar os lotes. Verifique sua conexão e tente novamente.</div>
          ) : isLoading && !data ? (
            <LoadingState label="Carregando lotes..." />
          ) : (
            <div className="flex-1">
              <DataTable data={data?.data ?? []} columns={columns} emptyMessage="Nenhum lote ainda" emptyHint="Envie a planilha ou use o lançamento rápido para começar." getRowId={(item) => item.id} />
            </div>
          )}

          {!isError && data && (
            <CrudPagination
              page={data.pagination.page}
              totalPages={totalPages}
              totalItems={data.pagination.total}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir rascunho"
        description={`Excluir o lote "${toDelete ? batchLabel(toDelete) : ''}"? As linhas em revisão serão apagadas; nada foi gravado nas contas.`}
        confirmText="Excluir"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Page>
  );
}
