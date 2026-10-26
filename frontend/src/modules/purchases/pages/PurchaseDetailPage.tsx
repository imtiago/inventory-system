import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { StatusBadge } from '@/components/ui/badge';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/details/Section';
import { DetailTable } from '@/shared/components/details/DetailTable';
import { Can } from '@/shared/auth/Can';
import { useCan } from '@/shared/auth/useCan';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { FINANCIAL_STATUS_LABELS } from '@/shared/utils/financialStatus';

import { usePurchase } from '../hooks/usePurchases';
import { ReceivePurchaseModal } from '../components/ReceivePurchaseModal';
import { CancelPurchaseModal } from '../components/CancelPurchaseModal';
import { PURCHASE_STATUS_LABELS } from '../types';

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: purchase, isLoading, isError, error } = usePurchase(id);
  const canReadPayables = useCan('payables.read');
  const [receiving, setReceiving] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const parsed = isError ? parseApiErrorSync(error) : null;
  const isNotFound = parsed?.status === 404 || parsed?.code === 'PURCHASE_NOT_FOUND';

  const canReceive = purchase !== undefined && (purchase.status === 'PENDING' || purchase.status === 'PARTIALLY_RECEIVED');
  const hasPayments = purchase?.payable?.parcels.some((parcel) => parcel.paidAmount > 0) ?? false;
  const canCancel = purchase !== undefined && purchase.status === 'PENDING' && purchase.items.every((item) => item.receivedQuantity === 0);

  const actions = purchase ? (
    <>
      {canReceive && (
        <Can permission="purchases.receive">
          <button type="button" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover" onClick={() => setReceiving(true)}>
            Registrar recebimento
          </button>
        </Can>
      )}
      {canCancel && hasPayments && (
        <Can permission="purchases.write">
          <p data-testid="cancel-blocked" className="max-w-xs text-sm text-muted">
            Este pedido tem pagamento registrado. Estorne os pagamentos em contas a pagar para poder cancelá-lo.
          </p>
        </Can>
      )}
      {canCancel && !hasPayments && (
        <Can permission="purchases.write">
          <button type="button" className="rounded-lg bg-danger-solid px-4 py-2 text-danger-foreground hover:bg-danger-solid/90" onClick={() => setCanceling(true)}>
            Cancelar pedido
          </button>
        </Can>
      )}
    </>
  ) : undefined;

  return (
    <Page width="narrow">
      <PageHeader
        title={purchase ? purchase.code : 'Pedido de compra'}
        description={purchase ? `Data do pedido: ${formatDateOnly(purchase.purchaseDate)}` : undefined}
        meta={purchase ? <StatusBadge status={purchase.status}>{PURCHASE_STATUS_LABELS[purchase.status] ?? purchase.status}</StatusBadge> : undefined}
        backPath="/purchases"
        backLabel="pedidos de compra"
        actions={actions}
      />

      {isLoading && <p className="text-sm text-muted">Carregando pedido...</p>}

      {isError && !purchase && (
        <div className="rounded-lg border border-danger/30 p-6 text-sm text-danger">{isNotFound ? 'Pedido não encontrado.' : 'Não foi possível carregar o pedido.'}</div>
      )}

      {purchase && (
        <>
          <Section title="Resumo">
            <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
              <div>
                <dt className="text-sm text-muted">Fornecedor</dt>
                <dd className="font-medium">{purchase.supplier.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Observações</dt>
                <dd className="font-medium">{purchase.notes ?? '—'}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Itens">
            <div className="p-4 sm:p-6">
              <DetailTable
                rows={purchase.items}
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
                  { id: 'received', header: 'Recebido', align: 'right', cell: (item) => item.receivedQuantity },
                  { id: 'remaining', header: 'Restante', align: 'right', cell: (item) => item.remainingQuantity },
                  { id: 'unitPrice', header: 'Preço unit.', align: 'right', cell: (item) => formatCurrency(item.unitPrice) },
                  { id: 'total', header: 'Total', align: 'right', cell: (item) => formatCurrency(item.total) },
                  { id: 'unitCost', header: 'Custo unit.', align: 'right', cell: (item) => formatCurrency(item.unitCost) },
                ]}
              />
            </div>
            <p className="border-t border-border bg-surface-muted px-4 py-3 text-right text-lg font-semibold tabular-nums sm:px-6">Total: {formatCurrency(purchase.totalAmount)}</p>
          </Section>

          {!canReadPayables && <p className="text-sm text-muted">Informações financeiras disponíveis para administradores.</p>}
          {canReadPayables && purchase.payable && (
            <Section
              title="Parcelas"
              actions={
                <Link to={`/payables/${purchase.payable.id}`} className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
                  Ver contas a pagar
                </Link>
              }
            >
              <div className="p-4 sm:p-6">
                <DetailTable
                  rows={purchase.payable.parcels}
                  getRowId={(parcel) => parcel.id}
                  columns={[
                    { id: 'number', header: '#', mobile: 'title', cell: (parcel) => <span className="font-medium">Parcela {parcel.number}</span> },
                    { id: 'dueDate', header: 'Vencimento', cell: (parcel) => formatDateOnly(parcel.dueDate) },
                    { id: 'amount', header: 'Valor', align: 'right', cell: (parcel) => formatCurrency(parcel.amount) },
                    { id: 'paid', header: 'Pago', align: 'right', cell: (parcel) => formatCurrency(parcel.paidAmount) },
                    { id: 'remaining', header: 'Restante', align: 'right', cell: (parcel) => formatCurrency(parcel.remainingAmount) },
                    { id: 'status', header: 'Status', cell: (parcel) => <StatusBadge status={parcel.status}>{FINANCIAL_STATUS_LABELS[parcel.status] ?? parcel.status}</StatusBadge> },
                  ]}
                />
              </div>
            </Section>
          )}
        </>
      )}

      {purchase && <ReceivePurchaseModal purchase={purchase} open={receiving} onClose={() => setReceiving(false)} />}
      {purchase && <CancelPurchaseModal purchaseId={purchase.id} open={canceling} onClose={() => setCanceling(false)} />}
    </Page>
  );
}
