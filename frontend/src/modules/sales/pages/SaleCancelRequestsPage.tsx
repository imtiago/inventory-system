import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { CrudPagination } from '@/shared/components/crud';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingState } from '@/shared/components/LoadingState';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateTime } from '@/shared/utils/formatDateTime';
import type { Tone } from '@/shared/utils/statusTone';

import { CancelReasonModal } from '../components/CancelReasonModal';
import { useApproveSaleCancelRequest, useRejectSaleCancelRequest } from '../hooks/useDecideSaleCancelRequest';
import { useSaleCancelRequests } from '../hooks/useSaleCancelRequests';
import type { ISaleCancelRequest } from '../types';

type Status = ISaleCancelRequest['status'];

const STATUS: Record<Status, { label: string; filter: string; tone: Tone }> = {
  PENDING: { label: 'Pendente', filter: 'Pendentes', tone: 'warning' },
  APPROVED: { label: 'Aprovado', filter: 'Aprovados', tone: 'success' },
  REJECTED: { label: 'Recusado', filter: 'Recusados', tone: 'danger' },
};
const STATUS_ORDER: Status[] = ['PENDING', 'REJECTED', 'APPROVED'];

export function SaleCancelRequestsPage() {
  const [status, setStatus] = useState<Status>('PENDING');
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<ISaleCancelRequest | null>(null);
  const [rejecting, setRejecting] = useState<ISaleCancelRequest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, isLoading, isError } = useSaleCancelRequests(page, status);
  const approve = useApproveSaleCancelRequest();
  const reject = useRejectSaleCancelRequest();

  function changeStatus(next: Status) {
    setStatus(next);
    setPage(1);
    setActionError(null);
  }

  function confirmApprove() {
    if (!approving) return;
    setActionError(null);
    approve.mutate(approving.id, {
      onSettled: () => setApproving(null),
      onError: (error) => setActionError(parseApiErrorSync(error).message || 'Não foi possível aprovar o pedido.'),
    });
  }

  const columns: DataTableColumn<ISaleCancelRequest>[] = [
    {
      id: 'customer',
      header: 'Venda',
      mobile: 'title',
      cell: (r) => (
        <>
          <Link to={`/sales/${r.saleId}`} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
            {r.customerName}
          </Link>
          <div className="text-xs font-normal text-muted">{`#${r.saleId.slice(0, 8).toUpperCase()}`}</div>
        </>
      ),
    },
    { id: 'total', header: 'Valor', numeric: true, mobile: 'meta', cell: (r) => formatCurrency(r.total) },
    { id: 'reason', header: 'Motivo', mobile: 'subtitle', cell: (r) => <span className="whitespace-normal break-words">{r.reason}</span> },
    {
      id: 'requestedBy',
      header: 'Pedido por',
      mobile: 'meta',
      cell: (r) => (
        <>
          <div>{r.requestedBy?.name ?? '—'}</div>
          <div className="text-xs text-muted">{formatDateTime(r.requestedAt)}</div>
        </>
      ),
    },
    {
      id: 'status',
      header: 'Situação',
      mobile: 'meta',
      cell: (r) => (
        <>
          <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
          {r.decisionReason && <div className="mt-1 whitespace-normal break-words text-xs text-muted">{r.decisionReason}</div>}
        </>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      mobile: 'actions',
      cell: (r) =>
        r.status === 'PENDING' ? (
          <div className="flex flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
            <Button type="button" variant="danger" aria-label={`Aprovar pedido de ${r.customerName}`} className="min-h-11 lg:min-h-9" onClick={() => { setActionError(null); setApproving(r); }}>
              Aprovar
            </Button>
            <Button type="button" variant="outline" aria-label={`Recusar pedido de ${r.customerName}`} className="min-h-11 lg:min-h-9" onClick={() => { setActionError(null); setRejecting(r); }}>
              Recusar
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <Page>
      <PageHeader title="Pedidos de cancelamento" description="Vendedores pedem o cancelamento; aprovar devolve o estoque e cancela a conta a receber." />

      <Section>
        <div className="flex flex-1 flex-col">
          <div role="group" aria-label="Situação" className="flex flex-wrap gap-2 border-b border-border p-4 sm:p-5">
            {STATUS_ORDER.map((s) => (
              <Button key={s} type="button" variant={status === s ? 'primary' : 'outline'} aria-pressed={status === s} className="min-h-11" onClick={() => changeStatus(s)}>
                {STATUS[s].filter}
              </Button>
            ))}
          </div>

          {actionError && (
            <div role="alert" className="m-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger sm:m-5">
              {actionError}
            </div>
          )}

          {isError ? (
            <div role="alert" className="m-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger sm:m-5">
              Não foi possível carregar os pedidos de cancelamento.
            </div>
          ) : isLoading ? (
            <LoadingState label="Carregando pedidos..." />
          ) : (
            <div className="flex-1">
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(r) => r.id} emptyMessage="Nenhum pedido de cancelamento" emptyHint="Quando um vendedor pedir o cancelamento de uma venda, o pedido aparece aqui." />
            </div>
          )}

          <div className="shrink-0">
            <CrudPagination
              page={data?.pagination.page ?? page}
              totalPages={data?.pagination.totalPages ?? 1}
              totalItems={data?.pagination.total ?? 0}
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(data?.pagination.totalPages ?? 1, p + 1))}
            />
          </div>
        </div>
      </Section>

      <ConfirmDialog
        open={approving !== null}
        title="Aprovar cancelamento"
        description={approving ? `A venda de ${approving.customerName} (${formatCurrency(approving.total)}) será cancelada: o estoque volta e a conta a receber é cancelada.` : ''}
        confirmText="Aprovar e cancelar"
        loadingText="Cancelando..."
        loading={approve.isPending}
        onConfirm={confirmApprove}
        onCancel={() => setApproving(null)}
      />

      {rejecting && (
        <CancelReasonModal
          title="Recusar pedido"
          description={`O pedido de ${rejecting.customerName} será recusado e a venda continua valendo. O vendedor verá o motivo.`}
          submitLabel="Confirmar recusa"
          pendingLabel="Recusando..."
          fallbackError="Não foi possível recusar o pedido."
          pending={reject.isPending}
          onSubmit={(reason) => reject.mutateAsync({ id: rejecting.id, reason })}
          onClose={() => setRejecting(null)}
        />
      )}
    </Page>
  );
}

export default SaleCancelRequestsPage;
