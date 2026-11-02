import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CircleAlert, PenLine, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { LoadingState } from '@/shared/components/LoadingState';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { useBreakpoint } from '@/shared/hooks/useMediaQuery';
import { parseApiErrorSync, type ApiError } from '@/shared/services/parseApiError';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { formatDateTime } from '@/shared/utils/formatDateTime';
import { formatPhone } from '@/shared/utils/formatPhone';
import { formatCurrency } from '@/shared/utils/money';

import { LegacyBatchSummary } from '../components/LegacyBatchSummary';
import { LegacyImportSteps } from '../components/LegacyImportSteps';
import { LegacyRowEditor } from '../components/LegacyRowEditor';
import { SimilarNameChooser } from '../components/SimilarNameChooser';
import { useConfirmLegacyBatch, useDeleteLegacyBatch, useLegacyBatch, useRevertLegacyBatch, useUpdateLegacyRow } from '../hooks/useLegacyImports';
import {
  CREDIT_PROFILE_LABELS,
  LEGACY_BATCH_STATUS_LABELS,
  LEGACY_ROW_STATUS_LABELS,
  LIMIT_RULE_LABELS,
  batchLabel,
  hasDuplicateDebt,
  hasPendingDuplicate,
  hasPendingSimilar,
  type LegacyBatch,
  type LegacyLimitRule,
  type LegacyRow,
  type UpdateLegacyRowInput,
} from '../types';
import { joinLines, plural } from '../utils/plural';
import { isMissingLinkedCustomer } from '../utils/rowErrors';

interface RowError {
  rowId: string;
  error: ApiError;
}

interface ConfirmError {
  message: string;
  code: string;
  lines: number[];
}

function linesOf(details: Record<string, unknown> | undefined): number[] {
  const lines = details?.lines;
  return Array.isArray(lines) ? lines.filter((n): n is number => typeof n === 'number') : [];
}

/** Revisão de um lote do caderninho: linhas editáveis, nomes parecidos, resumo, confirmar e desfazer. */
export function LegacyImportBatchPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: batch, isLoading, isError, error } = useLegacyBatch(id);

  if (isLoading) {
    return (
      <Page>
        <LoadingState label="Carregando lote..." />
      </Page>
    );
  }

  if (isError || !batch) {
    return (
      <Page>
        <PageHeader title="Lote do caderninho" backPath="/finance/legacy-imports" backLabel="migração do caderninho" />
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {parseApiErrorSync(error).message || 'Não foi possível carregar o lote.'}
        </div>
      </Page>
    );
  }

  return <BatchView key={batch.id} batch={batch} routeId={id} />;
}

function BatchView({ batch, routeId }: { batch: LegacyBatch; routeId: string }) {
  const navigate = useNavigate();
  const desktop = useBreakpoint('md');
  const draft = batch.status === 'DRAFT';
  const update = useUpdateLegacyRow(routeId);
  const confirm = useConfirmLegacyBatch(routeId);
  const revert = useRevertLegacyBatch(routeId);
  const remove = useDeleteLegacyBatch();

  const [onlyIssues, setOnlyIssues] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [rowError, setRowError] = useState<RowError | null>(null);
  const [limitRule, setLimitRule] = useState<LegacyLimitRule>(batch.limitRule ?? 'MAX_OF_PROFILE_AND_BALANCE');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<ConfirmError | null>(null);
  const [revertOpen, setRevertOpen] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rowsById = useMemo(() => new Map(batch.rows.map((row) => [row.id, row])), [batch.rows]);
  const visibleRows = onlyIssues ? batch.rows.filter((row) => row.status === 'WARNING' || row.status === 'ERROR') : batch.rows;
  const activeRows = batch.rows.filter((row) => row.status !== 'IGNORED');
  const errorLines = batch.rows.filter((row) => row.status === 'ERROR').map((row) => row.line);
  const similarLines = batch.rows.filter(hasPendingSimilar).map((row) => row.line);
  const duplicateLines = batch.rows.filter(hasPendingDuplicate).map((row) => row.line);
  const blockers: string[] = [];
  if (activeRows.length === 0) blockers.push('Não há linhas para confirmar (todas ignoradas ou lote vazio).');
  if (errorLines.length > 0) blockers.push(`Corrija ou ignore as linhas com erro: ${joinLines(errorLines)}`);
  if (similarLines.length > 0) blockers.push(`Decida os nomes parecidos: ${similarLines.length === 1 ? 'linha' : 'linhas'} ${joinLines(similarLines)}`);
  if (duplicateLines.length > 0) blockers.push(`Decida as dívidas que parecem já importadas: ${duplicateLines.length === 1 ? 'linha' : 'linhas'} ${joinLines(duplicateLines)}`);

  function changeRow(row: LegacyRow, input: UpdateLegacyRowInput) {
    setRowError(null);
    update.mutate(
      { rowId: row.id, input },
      {
        onError: (error) => setRowError({ rowId: row.id, error: parseApiErrorSync(error) }),
      },
    );
  }

  function createNewForLine(line: number) {
    const row = batch.rows.find((r) => r.line === line);
    if (!row) return;
    update.mutate(
      { rowId: row.id, input: { customerAction: { kind: 'NEW' } } },
      {
        onSuccess: () => setConfirmError((current) => (current ? { ...current, lines: current.lines.filter((l) => l !== line) } : current)),
        onError: (error) => setConfirmError({ message: parseApiErrorSync(error).message, code: '', lines: [] }),
      },
    );
  }

  function runConfirm() {
    setConfirmError(null);
    confirm.mutate(limitRule, {
      onSuccess: () => setConfirmOpen(false),
      onError: (error) => {
        const parsed = parseApiErrorSync(error);
        setConfirmOpen(false);
        setConfirmError({ message: parsed.message, code: parsed.code, lines: linesOf(parsed.details) });
      },
    });
  }

  function runRevert() {
    setRevertError(null);
    revert.mutate(undefined, {
      onSuccess: () => setRevertOpen(false),
      onError: (error) => {
        setRevertOpen(false);
        setRevertError(parseApiErrorSync(error).message);
      },
    });
  }

  function runDelete() {
    setDeleteError(null);
    remove.mutate(batch.id, {
      onSuccess: () => navigate('/finance/legacy-imports'),
      onError: (error) => {
        setDeleteOpen(false);
        setDeleteError(parseApiErrorSync(error).message);
      },
    });
  }

  const summary = batch.summary;
  const confirmDescription =
    `Serão gravadas ${plural(activeRows.length, 'dívida', 'dívidas')} (total ${formatCurrency(summary.openTotal)}) para ` +
    `${plural(summary.newCustomers, 'cliente novo', 'clientes novos')} e ${plural(summary.existingCustomers, 'cliente existente', 'clientes existentes')}. ` +
    `Limite de crédito: ${LIMIT_RULE_LABELS[limitRule].toLowerCase()}. As dívidas entram sem multa e sem juros. ` +
    'Depois de confirmado, o lote não pode mais ser editado; dá para desfazer enquanto nenhuma dívida receber pagamento.';

  const rowProps = {
    batchId: routeId,
    draft,
    rowsById,
    busy: update.isPending,
    rowError,
    editing,
    onEdit: (row: LegacyRow) => {
      setRowError(null);
      setEditing((current) => (current === row.id ? null : row.id));
    },
    onCloseEditor: () => setEditing(null),
    onChange: changeRow,
  };

  return (
    <Page>
      <PageHeader
        title={batchLabel(batch)}
        backPath="/finance/legacy-imports"
        backLabel="migração do caderninho"
        description={`Lote do caderninho · criado por ${batch.createdBy?.name ?? '—'} em ${formatDateTime(batch.createdAt)}`}
        meta={<StatusBadge status={batch.status}>{LEGACY_BATCH_STATUS_LABELS[batch.status] ?? batch.status}</StatusBadge>}
        actions={
          draft ? (
            <>
              <Link
                to={`/finance/legacy-imports/${batch.id}/quick`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-input bg-surface px-4 py-2 text-foreground hover:bg-surface-muted"
              >
                <PenLine size={16} aria-hidden="true" />
                Lançamento rápido
              </Link>
              <Button type="button" variant="outline" className="min-h-11 text-danger" onClick={() => setDeleteOpen(true)}>
                Excluir rascunho
              </Button>
            </>
          ) : undefined
        }
      />

      <LegacyImportSteps current={draft ? 3 : 4} finished={!draft} compact />

      {deleteError && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {deleteError}
        </div>
      )}

      {batch.status === 'CONFIRMED' && (
        <div className="rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-success">
          <p className="font-medium">
            {`Lote confirmado em ${formatDateTime(batch.confirmedAt)}: ${plural(activeRows.length, 'dívida gravada', 'dívidas gravadas')} (total ${formatCurrency(summary.openTotal)}) para ${plural(summary.newCustomers, 'cliente novo', 'clientes novos')} e ${plural(summary.existingCustomers, 'cliente existente', 'clientes existentes')}.`}
          </p>
          <p className="mt-1">As dívidas aparecem em Contas a receber com a etiqueta &quot;Caderninho&quot;.</p>
        </div>
      )}
      {batch.status === 'REVERTED' && (
        <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-foreground">
          <p className="font-medium">{`Lote desfeito em ${formatDateTime(batch.revertedAt)}.`}</p>
          <p className="mt-1 text-muted">As dívidas foram canceladas; os clientes continuam cadastrados.</p>
        </div>
      )}

      {draft && batch.sameFileAs && (
        <div data-testid="same-file-warning" role="status" className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} aria-hidden="true" />
            {`Este arquivo já foi importado (lote confirmado em ${formatDateTime(batch.sameFileAs.confirmedAt)}).`}
          </p>
          <p className="mt-1">Confirmar de novo duplica as dívidas. As linhas repetidas estão marcadas: ignore-as ou importe só as que forem dívidas novas.</p>
          <Link to={`/finance/legacy-imports/${batch.sameFileAs.id}`} className="mt-1 inline-flex min-h-11 items-center font-medium underline">
            Ver o lote anterior
          </Link>
        </div>
      )}

      <LegacyBatchSummary summary={summary} />

      <section aria-labelledby="legacy-rows-title" className="flex min-w-0 flex-col rounded-xl bg-surface shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h2 id="legacy-rows-title" className="text-lg font-semibold text-foreground">
              Linhas ({batch.rows.length})
            </h2>
            {draft && <p className="text-sm text-muted">Edite na própria linha. Nada é gravado nas contas até confirmar.</p>}
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="h-5 w-5" />
            Só com aviso ou erro
          </label>
        </div>

        {visibleRows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{onlyIssues ? 'Nenhuma linha com aviso ou erro.' : 'O lote não tem linhas.'}</p>
        ) : desktop ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Linha
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Cliente
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Compra
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Em aberto
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Situação
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <RowTable key={row.id} row={row} {...rowProps} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 p-3">
            {visibleRows.map((row) => (
              <RowCard key={row.id} row={row} {...rowProps} />
            ))}
          </ul>
        )}
      </section>

      {draft && (
        <section aria-labelledby="legacy-confirm-title" className="flex flex-col gap-4 rounded-xl bg-surface p-4 shadow sm:p-6">
          <h2 id="legacy-confirm-title" className="text-lg font-semibold text-foreground">
            Confirmar o lote
          </h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Limite de crédito de cada cliente</legend>
            {(Object.keys(LIMIT_RULE_LABELS) as LegacyLimitRule[]).map((rule) => (
              <label key={rule} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <input type="radio" name="limit-rule" value={rule} checked={limitRule === rule} onChange={() => setLimitRule(rule)} className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">
                    {LIMIT_RULE_LABELS[rule]}
                    {rule === 'MAX_OF_PROFILE_AND_BALANCE' ? ' (recomendado)' : ''}
                  </span>
                  <span className="mt-0.5 block text-muted">
                    {rule === 'MAX_OF_PROFILE_AND_BALANCE' ? 'O cliente não começa com o limite estourado pela dívida antiga.' : 'Usa o limite inicial do perfil, mesmo que a dívida passe dele.'}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {blockers.length > 0 && (
            <div data-testid="confirm-blockers" className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle size={16} aria-hidden="true" />
                Para confirmar:
              </p>
              <ul className="mt-1 list-disc pl-6">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {confirmError && (
            <div role="alert" data-testid="confirm-error" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              <p>{confirmError.message}</p>
              {confirmError.lines.length > 0 && <p className="mt-1">{`Linhas: ${joinLines(confirmError.lines)}`}</p>}
              {confirmError.code === 'CUSTOMER_NOT_FOUND' && confirmError.lines.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {confirmError.lines.map((line) => (
                    <Button key={line} type="button" variant="outline" className="min-h-11" disabled={update.isPending} onClick={() => createNewForLine(line)}>
                      {`Criar cliente novo na linha ${line}`}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={blockers.length > 0 || confirm.isPending} onClick={() => setConfirmOpen(true)}>
              Confirmar lote
            </Button>
          </div>
        </section>
      )}

      {batch.status === 'CONFIRMED' && (
        <section aria-labelledby="legacy-revert-title" className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow sm:p-6">
          <h2 id="legacy-revert-title" className="text-lg font-semibold text-foreground">
            Desfazer
          </h2>
          <p className="text-sm text-muted">Cancela as dívidas deste lote. Os clientes continuam cadastrados. Só é possível enquanto nenhuma dívida do lote recebeu pagamento.</p>
          {revertError && (
            <div role="alert" data-testid="revert-error" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              {revertError}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="min-h-11 w-full text-danger sm:w-auto" disabled={revert.isPending} onClick={() => setRevertOpen(true)}>
              <RotateCcw size={16} aria-hidden="true" />
              Desfazer lote
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar lote"
        description={confirmDescription}
        confirmText="Confirmar lote"
        loadingText="Confirmando..."
        loading={confirm.isPending}
        onConfirm={runConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={revertOpen}
        title="Desfazer lote"
        description="As dívidas deste lote serão canceladas. Os clientes continuam cadastrados, com o perfil e o limite que receberam. Se alguma dívida já recebeu pagamento, o sistema recusa: estorne o pagamento antes."
        confirmText="Desfazer lote"
        loadingText="Desfazendo..."
        loading={revert.isPending}
        onConfirm={runRevert}
        onCancel={() => setRevertOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir rascunho"
        description="Excluir este lote? As linhas em revisão serão apagadas; nada foi gravado nas contas."
        confirmText="Excluir"
        loading={remove.isPending}
        onConfirm={runDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </Page>
  );
}

interface RowProps {
  row: LegacyRow;
  batchId: string;
  draft: boolean;
  rowsById: Map<string, LegacyRow>;
  busy: boolean;
  rowError: RowError | null;
  editing: string | null;
  onEdit: (row: LegacyRow) => void;
  onCloseEditor: () => void;
  onChange: (row: LegacyRow, input: UpdateLegacyRowInput) => void;
}

function Issues({ row }: { row: LegacyRow }) {
  if (row.issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {row.issues.map((issue, index) => (
        <li key={`${issue.code}-${index}`} className={`flex items-start gap-1.5 text-sm ${issue.severity === 'ERROR' ? 'text-danger' : 'text-warning'}`}>
          <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

function Amounts({ row }: { row: LegacyRow }) {
  const d = row.data;
  return (
    <div className="tabular-nums">
      <p className="font-medium text-foreground">{formatCurrency(d.open)}</p>
      <p className="text-xs text-muted">
        {`Total ${formatCurrency(d.total)}`}
        {d.paid > 0 ? ` · pago ${formatCurrency(d.paid)}` : ''}
      </p>
      {d.dueDates && d.dueDates.length > 0 ? (
        <p className="text-xs text-muted">{plural(d.dueDates.length, 'vencimento', 'vencimentos')}</p>
      ) : (
        <p className="text-xs text-muted">Vencimento a combinar</p>
      )}
    </div>
  );
}

function Purchase({ row }: { row: LegacyRow }) {
  const d = row.data;
  return (
    <div className="min-w-0">
      <p className="text-foreground">{d.purchaseDate ? formatDateOnly(d.purchaseDate) : 'Sem data'}</p>
      {d.description && <p className="break-words text-xs text-muted">{d.description}</p>}
      {d.profileCode && <p className="text-xs text-muted">{`Perfil ${CREDIT_PROFILE_LABELS[d.profileCode]}`}</p>}
      {d.notes && <p className="break-words text-xs text-muted">{d.notes}</p>}
    </div>
  );
}

function Customer({ row, draft, rowsById, busy, onChange }: RowProps) {
  const ignored = row.status === 'IGNORED';
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div>
        <p className={`break-words font-medium ${ignored ? 'text-muted line-through' : 'text-foreground'}`}>{row.data.name || 'Sem nome'}</p>
        {row.data.phone && <p className="text-xs text-muted">{formatPhone(row.data.phone)}</p>}
      </div>
      {draft && !ignored && <SimilarNameChooser row={row} rowsById={rowsById} disabled={busy} onChange={(input) => onChange(row, input)} />}
      {!draft && <ImportedCustomer row={row} rowsById={rowsById} />}
    </div>
  );
}

function ImportedCustomer({ row, rowsById }: { row: LegacyRow; rowsById: Map<string, LegacyRow> }) {
  if (row.status === 'IGNORED') return null;
  const action = row.customerAction;
  const text =
    action.kind === 'LINK' ? (row.linkedCustomerName ? `Cliente já cadastrado: ${row.linkedCustomerName}` : 'Cliente já cadastrado') : action.kind === 'SAME_AS_ROW' ? `Mesma pessoa da linha ${rowsById.get(action.rowId)?.line ?? '?'}` : 'Cliente criado na confirmação';
  return <p className="text-xs text-muted">{text}</p>;
}

function RowActions({ row, draft, busy, editing, onEdit, onChange }: RowProps) {
  if (!draft) {
    return (
      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        {row.financialDocumentId && (
          <Link to={`/receivables/${row.financialDocumentId}`} className="inline-flex min-h-11 items-center font-medium hover:underline">
            Ver dívida
          </Link>
        )}
        {row.customerId && (
          <Link to={`/customers/${row.customerId}`} className="inline-flex min-h-11 items-center font-medium hover:underline">
            Ver cliente
          </Link>
        )}
      </div>
    );
  }
  const ignored = row.status === 'IGNORED';
  // Com nome parecido ou dívida repetida pendente, "Ignorar linha" fica nas opções da decisão.
  const showIgnore = !ignored && !hasPendingSimilar(row) && !hasPendingDuplicate(row);
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      {!ignored && (
        <Button type="button" variant="outline" className="min-h-11" aria-expanded={editing === row.id} disabled={busy} onClick={() => onEdit(row)}>
          Editar
        </Button>
      )}
      {showIgnore && (
        <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => onChange(row, { ignored: true })}>
          Ignorar linha
        </Button>
      )}
      {ignored && (
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onChange(row, { ignored: false })}>
          Restaurar linha
        </Button>
      )}
    </div>
  );
}

function RowErrorBox({ row, rowError, busy, onChange }: RowProps) {
  if (!rowError || rowError.rowId !== row.id) return null;
  const missing = isMissingLinkedCustomer(row, rowError.error);
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
      <p>{rowError.error.message}</p>
      {missing && (
        <>
          <p className="mt-1">O cliente vinculado pode ter sido excluído.</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={busy} onClick={() => onChange(row, { customerAction: { kind: 'NEW' } })}>
            Criar cliente novo
          </Button>
        </>
      )}
    </div>
  );
}

/** Dívida que parece já importada: "Importar mesmo assim" ou "Ignorar linha"; aceita, dá para desfazer. */
function DuplicateChoice({ row, draft, busy, onChange }: RowProps) {
  if (!draft || !hasDuplicateDebt(row)) return null;
  if (row.acceptDuplicate) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Será importada mesmo assim.</span>
        <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => onChange(row, { acceptDuplicate: false })}>
          Desfazer escolha
        </Button>
      </div>
    );
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-warning">É outra dívida?</legend>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onChange(row, { acceptDuplicate: true })}>
          Importar mesmo assim
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onChange(row, { ignored: true })}>
          Ignorar linha
        </Button>
      </div>
    </fieldset>
  );
}

function StatusCell({ row }: { row: LegacyRow }) {
  return <StatusBadge status={row.status}>{LEGACY_ROW_STATUS_LABELS[row.status] ?? row.status}</StatusBadge>;
}

function RowTable(props: RowProps) {
  const { row, batchId, editing, onCloseEditor, onChange } = props;
  const ignored = row.status === 'IGNORED';
  return (
    <Fragment>
      <tr data-testid={`legacy-row-${row.line}`} className={`border-t border-border align-top ${ignored ? 'bg-surface-muted/50' : ''}`}>
        <td className="px-4 py-3 tabular-nums text-muted">{row.line}</td>
        <td className="w-[30%] px-4 py-3">
          <Customer {...props} />
        </td>
        <td className="px-4 py-3">
          <Purchase row={row} />
        </td>
        <td className="px-4 py-3 text-right">
          <Amounts row={row} />
        </td>
        <td className="w-[24%] px-4 py-3">
          <div className="flex flex-col gap-2">
            <span>
              <StatusCell row={row} />
            </span>
            <Issues row={row} />
            <DuplicateChoice {...props} />
            <RowErrorBox {...props} />
          </div>
        </td>
        <td className="px-4 py-3">
          <RowActions {...props} />
        </td>
      </tr>
      {editing === row.id && (
        <tr>
          <td colSpan={6} className="px-4 pb-4">
            <LegacyRowEditor batchId={batchId} row={row} onClose={onCloseEditor} onCreateNew={() => onChange(row, { customerAction: { kind: 'NEW' } })} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function RowCard(props: RowProps) {
  const { row, batchId, editing, onCloseEditor, onChange } = props;
  const ignored = row.status === 'IGNORED';
  return (
    <li data-testid={`legacy-row-${row.line}`} className={`flex flex-col gap-3 rounded-xl border border-border p-3 ${ignored ? 'bg-surface-muted/50' : 'bg-surface'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{`Linha ${row.line}`}</span>
        <StatusCell row={row} />
      </div>
      <Customer {...props} />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Purchase row={row} />
        <div className="text-right">
          <Amounts row={row} />
        </div>
      </div>
      <Issues row={row} />
      <DuplicateChoice {...props} />
      <RowErrorBox {...props} />
      <RowActions {...props} />
      {editing === row.id && <LegacyRowEditor batchId={batchId} row={row} onClose={onCloseEditor} onCreateNew={() => onChange(row, { customerAction: { kind: 'NEW' } })} />}
    </li>
  );
}
