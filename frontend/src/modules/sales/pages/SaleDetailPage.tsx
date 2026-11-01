import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/details/Section';
import { DetailTable } from '@/shared/components/details/DetailTable';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Modal } from '@/shared/components/Modal/Modal';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { useSale } from '../hooks/useSale';
import { useCancelSale } from '../hooks/useCancelSale';
import { FINANCIAL_STATUS_LABELS } from '@/shared/utils/financialStatus';
import { Can } from '@/shared/auth/Can';
import { useCan } from '@/shared/auth/useCan';
import { RequestCancelModal } from '../components/RequestCancelModal';
import { LoadingState } from '@/shared/components/LoadingState';
import { formatDateTime } from '@/shared/utils/formatDateTime';
import { CreditDocumentsActions } from '@/modules/credit/components/CreditDocumentsActions';

const saleStatusLabels: Record<string, string> = {
  COMPLETED: 'Concluída',
  CANCELED: 'Cancelada',
  PENDING: 'Pendente',
};

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sale, isLoading, isError, error: loadError } = useSale(id);
  const queryClient = useQueryClient();
  const cancel = useCancelSale(id ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const canCancel = useCan('sales.cancel');
  const canRequest = useCan('sales.cancel.request');

  // Active payments (reversed ones are already out of paidAmount) block the cancellation on the backend too.
  const hasPayments = sale?.receivable?.parcels.some((parcel) => parcel.paidAmount > 0) ?? false;

  const parsedLoadError = isError ? parseApiErrorSync(loadError) : null;
  const isNotFound = parsedLoadError?.status === 404 || parsedLoadError?.code === 'SALE_NOT_FOUND';

  function closeDialog() {
    if (cancel.isPending) return;
    setConfirmOpen(false);
  }

  function handleConfirm() {
    setCancelError(null);
    cancel.mutate(undefined, {
      onSuccess: () => setConfirmOpen(false),
      onError: (error) => {
        const parsed = parseApiErrorSync(error);
        setCancelError(parsed.message || 'Não foi possível cancelar a venda.');
        if (parsed.code === 'CONCURRENT_UPDATE' || parsed.code === 'SALE_ALREADY_CANCELED') {
          void queryClient.invalidateQueries({ queryKey: [...queryKeys.sales, 'detail', id] });
        }
        setConfirmOpen(false);
      },
    });
  }

  const cancelAction =
    sale && sale.status !== 'CANCELED' ? (
      hasPayments ? (
        <Can permission="sales.cancel.request">
          <p data-testid="cancel-blocked" className="max-w-xs text-sm text-muted">
            {canCancel
              ? 'Esta venda tem pagamento registrado. Estorne os pagamentos em contas a receber para poder cancelá-la.'
              : 'Esta venda tem pagamento registrado. Um administrador precisa estornar os pagamentos antes do cancelamento.'}
          </p>
        </Can>
      ) : canCancel ? (
        <Can permission="sales.cancel">
          <button
            type="button"
            className="rounded-lg bg-danger-solid px-4 py-2 text-danger-foreground hover:bg-danger-solid/90 disabled:opacity-50"
            onClick={() => {
              setCancelError(null);
              setConfirmOpen(true);
            }}
          >
            Cancelar venda
          </button>
        </Can>
      ) : canRequest && !sale.pendingCancelRequest ? (
        <button
          type="button"
          className="min-h-11 rounded-lg bg-danger-solid px-4 py-2 text-danger-foreground hover:bg-danger-solid/90 disabled:opacity-50"
          onClick={() => setRequestOpen(true)}
        >
          Pedir cancelamento
        </button>
      ) : undefined
    ) : undefined;

  return (
    <Page width="narrow">
      <PageHeader
        title={sale ? `Venda #${sale.id.slice(0, 8).toUpperCase()}` : 'Venda'}
        description={sale ? formatDateTime(sale.createdAt) : undefined}
        meta={
          sale ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={sale.status}>{saleStatusLabels[sale.status] ?? sale.status}</StatusBadge>
              {sale.pendingCancelRequest && <Badge tone="warning">Cancelamento pedido</Badge>}
            </div>
          ) : undefined
        }
        backPath="/sales"
        backLabel="vendas"
        actions={cancelAction}
      />

      {isLoading && <LoadingState label="Carregando venda..." />}

      {isError && (
        <div className="rounded-lg border border-danger/30 p-6 text-sm text-danger">
          {isNotFound ? 'Venda não encontrada.' : 'Não foi possível carregar a venda.'}
        </div>
      )}

      {cancelError && (
        <div role="alert" className="rounded-lg border border-danger/30 p-4 text-sm text-danger">
          {cancelError}
        </div>
      )}

      {sale?.pendingCancelRequest && (
        <div data-testid="cancel-request-notice" className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          <p className="font-medium">
            {`Cancelamento pedido${sale.pendingCancelRequest.requestedBy ? ` por ${sale.pendingCancelRequest.requestedBy.name}` : ''} em ${formatDateTime(sale.pendingCancelRequest.requestedAt)}`}
          </p>
          <p className="mt-1 whitespace-normal break-words">{`Motivo: ${sale.pendingCancelRequest.reason}`}</p>
          <Can permission="sales.cancel">
            <Link to="/sales/cancel-requests" className="mt-2 inline-block font-medium underline underline-offset-2">
              Ver pedidos de cancelamento
            </Link>
          </Can>
        </div>
      )}

      {sale && sale.status !== 'CANCELED' && sale.latestDecidedCancelRequest?.status === 'REJECTED' && (
        <div data-testid="cancel-request-rejected" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <p className="whitespace-normal break-words font-medium">
            {`Pedido de cancelamento recusado: ${sale.latestDecidedCancelRequest.decisionReason ?? '—'}`}
          </p>
          {sale.latestDecidedCancelRequest.decidedAt && (
            <p className="mt-1">
              {`${sale.latestDecidedCancelRequest.decidedBy ? `Por ${sale.latestDecidedCancelRequest.decidedBy.name} em ` : 'Em '}${formatDateTime(sale.latestDecidedCancelRequest.decidedAt)}`}
            </p>
          )}
        </div>
      )}

      {sale && (
        <>
          <CreditDocumentsActions sale={sale} />

          <Section title="Resumo">
            <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
              <div>
                <dt className="text-sm text-muted">Cliente</dt>
                <dd className="font-medium">{sale.customer.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Vendedor</dt>
                <dd className="font-medium">{sale.seller?.name ?? '—'}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Itens">
            <div className="p-4 sm:p-6">
              <DetailTable
                rows={sale.items}
                getRowId={(item) => item.id}
                columns={[
                  {
                    id: 'product',
                    header: 'Produto',
                    mobile: 'title',
                    cell: (item) => (
                      <>
                        <div className="font-medium">{item.productVariant.name}</div>
                        <div className="text-xs font-normal text-muted">{item.productVariant.code}</div>
                      </>
                    ),
                  },
                  { id: 'quantity', header: 'Qtd.', align: 'right', cell: (item) => item.quantity },
                  { id: 'unitPrice', header: 'Preço unit.', align: 'right', cell: (item) => formatCurrency(item.unitPrice) },
                  { id: 'total', header: 'Total', align: 'right', cell: (item) => formatCurrency(item.totalPrice) },
                ]}
              />
            </div>
            <p className="border-t border-border bg-surface-muted px-4 py-3 text-right text-lg font-semibold tabular-nums sm:px-6">Total: {formatCurrency(sale.totalAmount)}</p>
          </Section>

          {sale.receivable && (
            <Section
              title="Parcelas"
              actions={
                <Link to={`/receivables/${sale.receivable.id}`} className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
                  Ver contas a receber
                </Link>
              }
            >
              <div className="p-4 sm:p-6">
                <DetailTable
                  rows={sale.receivable.parcels.map((parcel, index) => ({ parcel, number: index + 1 }))}
                  getRowId={(row) => row.parcel.id}
                  columns={[
                    { id: 'number', header: '#', mobile: 'title', cell: (row) => <span className="font-medium">Parcela {row.number}</span> },
                    { id: 'dueDate', header: 'Vencimento', cell: (row) => formatDateOnly(row.parcel.dueDate) },
                    { id: 'amount', header: 'Valor', align: 'right', cell: (row) => formatCurrency(row.parcel.amount) },
                    { id: 'paid', header: 'Pago', align: 'right', cell: (row) => formatCurrency(row.parcel.paidAmount) },
                    { id: 'remaining', header: 'Restante', align: 'right', cell: (row) => formatCurrency(row.parcel.remainingAmount) },
                    { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.parcel.status}>{FINANCIAL_STATUS_LABELS[row.parcel.status] ?? row.parcel.status}</StatusBadge> },
                  ]}
                />
              </div>
            </Section>
          )}
        </>
      )}

      <Modal open={confirmOpen} onClose={closeDialog} busy={cancel.isPending} title="Cancelar venda" description="O estoque será devolvido e a conta a receber cancelada. Deseja continuar?" size="sm">
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 hover:bg-surface-muted disabled:opacity-50" onClick={closeDialog} disabled={cancel.isPending}>
            Voltar
          </button>
          <button type="button" className="rounded-lg bg-danger-solid px-4 py-2 text-danger-foreground hover:bg-danger-solid/90 disabled:opacity-50" onClick={handleConfirm} disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </Modal>

      {requestOpen && id && <RequestCancelModal saleId={id} onClose={() => setRequestOpen(false)} />}
    </Page>
  );
}
