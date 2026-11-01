import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingState } from '@/shared/components/LoadingState';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { notify } from '@/shared/utils/notify';
import type { Tone } from '@/shared/utils/statusTone';

import { useApplyCreditReview, useCreditReviewPreview } from '../hooks/useCredit';
import { CREDIT_PROFILE_NAMES, CREDIT_STATUS_LABELS, type CreditReviewAction, type CreditReviewItem } from '../types';

const ACTIONS: Record<CreditReviewAction, { label: string; tone: Tone }> = {
  UP: { label: 'Sobe', tone: 'success' },
  DOWN: { label: 'Desce', tone: 'warning' },
  SUSPEND: { label: 'Suspende', tone: 'danger' },
};
const checkbox = 'h-5 w-5 shrink-0 rounded-lg border-input accent-primary';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Change({ from, to }: { from: string; to: string }) {
  if (from === to) return <span>{to}</span>;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-muted">{from}</span>
      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
      <span className="font-semibold">{to}</span>
    </span>
  );
}

export function CreditReviewPage() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useCreditReviewPreview();
  const apply = useApplyCreditReview();

  const rows = useMemo(() => data ?? [], [data]);
  // Só conta quem ainda está na prévia (depois de recalcular, quem saiu da lista deixa de valer).
  const chosen = useMemo(() => rows.filter((r) => selected.has(r.customerId)).map((r) => r.customerId), [rows, selected]);
  const allChosen = rows.length > 0 && chosen.length === rows.length;

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);

      return next;
    });
  }

  async function confirmApply() {
    setApplyError(null);
    try {
      const applied = await apply.mutateAsync(chosen);
      notify.success(`${plural(applied.length, 'cliente revisado', 'clientes revisados')}.`);
      setSelected(new Set());
    } catch (error) {
      setApplyError(parseApiErrorSync(error).message || 'Não foi possível aplicar a revisão.');
    } finally {
      setConfirming(false);
    }
  }

  const columns: DataTableColumn<CreditReviewItem>[] = [
    {
      id: 'customer',
      header: 'Cliente',
      mobile: 'title',
      cell: (r) => (
        <div className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className={checkbox} checked={selected.has(r.customerId)} onChange={(e) => toggle(r.customerId, e.target.checked)} aria-label={`Selecionar ${r.customerName}`} />
          <Link to={`/customers/${r.customerId}`} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
            {r.customerName}
          </Link>
        </div>
      ),
    },
    { id: 'action', header: 'Ação', mobile: 'meta', cell: (r) => <Badge tone={ACTIONS[r.action].tone}>{ACTIONS[r.action].label}</Badge> },
    { id: 'profile', header: 'Perfil', mobile: 'meta', cell: (r) => <Change from={CREDIT_PROFILE_NAMES[r.fromProfile]} to={CREDIT_PROFILE_NAMES[r.toProfile]} /> },
    { id: 'limit', header: 'Limite', mobile: 'meta', cell: (r) => <Change from={formatCurrency(r.fromLimit)} to={formatCurrency(r.toLimit)} /> },
    { id: 'status', header: 'Situação', mobile: 'meta', cell: (r) => <Change from={CREDIT_STATUS_LABELS[r.fromStatus]} to={CREDIT_STATUS_LABELS[r.toStatus]} /> },
    { id: 'reason', header: 'Motivo', mobile: 'subtitle', cell: (r) => <span className="whitespace-normal break-words">{r.reason}</span> },
  ];

  return (
    <Page>
      <PageHeader
        title="Revisão de crédito"
        description="Veja o que a revisão periódica mudaria nos limites dos clientes e aplique só nos que escolher. Nada muda até você confirmar. Baixar limite não altera a dívida existente, só bloqueia compra nova."
        actions={
          <Button type="button" variant="outline" className="min-h-11" disabled={isFetching || apply.isPending} onClick={() => void refetch()}>
            Rodar revisão agora
          </Button>
        }
      />

      <Section>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
              <input type="checkbox" className={checkbox} checked={allChosen} disabled={rows.length === 0 || apply.isPending} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.customerId)) : new Set())} aria-label="Selecionar todos" />
              Selecionar todos
            </label>
            <Button type="button" disabled={chosen.length === 0 || apply.isPending} onClick={() => setConfirming(true)} className="min-h-11">
              {`Aplicar selecionados (${chosen.length})`}
            </Button>
          </div>

          {applyError && (
            <div role="alert" className="m-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger sm:m-5">
              {applyError}
            </div>
          )}

          {isError ? (
            <div role="alert" className="m-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger sm:m-5">
              Não foi possível calcular a revisão.
            </div>
          ) : isLoading ? (
            <LoadingState label="Calculando a revisão..." />
          ) : (
            <div className="flex-1">
              <DataTable data={rows} columns={columns} getRowId={(r) => r.customerId} emptyMessage="Nenhuma mudança proposta" emptyHint="Nenhum cliente sobe, desce ou é suspenso na revisão de hoje." />
            </div>
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={confirming}
        title="Aplicar revisão"
        description={`Aplicar a revisão em ${plural(chosen.length, 'cliente', 'clientes')}? Perfil, limite e situação mudam e cada mudança fica no histórico do cliente.`}
        confirmText="Aplicar"
        loadingText="Aplicando..."
        loading={apply.isPending}
        onConfirm={() => void confirmApply()}
        onCancel={() => setConfirming(false)}
      />
    </Page>
  );
}

export default CreditReviewPage;
