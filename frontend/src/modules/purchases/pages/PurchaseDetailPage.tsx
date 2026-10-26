import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { CrudBadge } from '@/shared/components/crud';
import { Page } from '@/shared/components/layout/Page';
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

  return (
    <Page>
      <div className="flex-1 overflow-y-auto p-4">
        <Link to="/purchases" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:underline">
          <ArrowLeft size={16} />
          Voltar para pedidos de compra
        </Link>

        {isLoading && <p className="text-sm text-gray-500">Carregando pedido...</p>}

        {isError && !purchase && (
          <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">{isNotFound ? 'Pedido não encontrado.' : 'Não foi possível carregar o pedido.'}</div>
        )}

        {purchase && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">{purchase.code}</h1>
                <p className="text-sm text-gray-500">Data do pedido: {formatDateOnly(purchase.purchaseDate)}</p>
                <div className="mt-2">
                  <CrudBadge>{PURCHASE_STATUS_LABELS[purchase.status] ?? purchase.status}</CrudBadge>
                </div>
              </div>

              <div className="flex gap-2">
                {canReceive && (
                  <Can permission="purchases.receive">
                    <button type="button" className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800" onClick={() => setReceiving(true)}>
                      Registrar recebimento
                    </button>
                  </Can>
                )}
                {canCancel && hasPayments && (
                  <Can permission="purchases.write">
                    <p data-testid="cancel-blocked" className="max-w-xs text-sm text-gray-600">
                      Este pedido tem pagamento registrado. Estorne os pagamentos em contas a pagar para poder cancelá-lo.
                    </p>
                  </Can>
                )}
                {canCancel && !hasPayments && (
                  <Can permission="purchases.write">
                    <button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700" onClick={() => setCanceling(true)}>
                      Cancelar pedido
                    </button>
                  </Can>
                )}
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">Fornecedor</dt>
                <dd className="font-medium">{purchase.supplier.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Observações</dt>
                <dd className="font-medium">{purchase.notes ?? '—'}</dd>
              </div>
            </dl>

            <section>
              <h2 className="mb-2 font-semibold">Itens</h2>
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
                        <div className="text-xs font-normal text-gray-500">{item.productVariant.code}</div>
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
              <p className="mt-3 text-right text-lg font-semibold">Total: {formatCurrency(purchase.totalAmount)}</p>
            </section>

            {!canReadPayables && <p className="text-sm text-gray-500">Informações financeiras disponíveis para administradores.</p>}
            {canReadPayables && purchase.payable && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">Parcelas</h2>
                  <Link to={`/payables/${purchase.payable.id}`} className="text-sm font-medium hover:underline">
                    Ver contas a pagar
                  </Link>
                </div>
                <DetailTable
                  rows={purchase.payable.parcels}
                  getRowId={(parcel) => parcel.id}
                  columns={[
                    { id: 'number', header: '#', mobile: 'title', cell: (parcel) => <span className="font-medium">Parcela {parcel.number}</span> },
                    { id: 'dueDate', header: 'Vencimento', cell: (parcel) => formatDateOnly(parcel.dueDate) },
                    { id: 'amount', header: 'Valor', align: 'right', cell: (parcel) => formatCurrency(parcel.amount) },
                    { id: 'paid', header: 'Pago', align: 'right', cell: (parcel) => formatCurrency(parcel.paidAmount) },
                    { id: 'remaining', header: 'Restante', align: 'right', cell: (parcel) => formatCurrency(parcel.remainingAmount) },
                    { id: 'status', header: 'Status', cell: (parcel) => FINANCIAL_STATUS_LABELS[parcel.status] ?? parcel.status },
                  ]}
                />
              </section>
            )}
          </div>
        )}
      </div>

      {purchase && <ReceivePurchaseModal purchase={purchase} open={receiving} onClose={() => setReceiving(false)} />}
      {purchase && <CancelPurchaseModal purchaseId={purchase.id} open={canceling} onClose={() => setCanceling(false)} />}
    </Page>
  );
}
