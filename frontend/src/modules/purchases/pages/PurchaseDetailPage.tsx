import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { CrudBadge } from '@/shared/components/crud';
import { Page } from '@/shared/components/layout/Page';
import { Can } from '@/shared/auth/Can';
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
  const [receiving, setReceiving] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const parsed = isError ? parseApiErrorSync(error) : null;
  const isNotFound = parsed?.status === 404 || parsed?.code === 'PURCHASE_NOT_FOUND';

  const canReceive = purchase !== undefined && (purchase.status === 'PENDING' || purchase.status === 'PARTIALLY_RECEIVED');
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
                {canCancel && (
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2">Produto</th>
                      <th className="py-2 text-right">Qtd.</th>
                      <th className="py-2 text-right">Recebido</th>
                      <th className="py-2 text-right">Restante</th>
                      <th className="py-2 text-right">Preço unit.</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2 text-right">Custo unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">
                          <div className="font-medium">{item.productVariant.name}</div>
                          <div className="text-xs text-gray-500">{item.productVariant.code}</div>
                        </td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">{item.receivedQuantity}</td>
                        <td className="py-2 text-right">{item.remainingQuantity}</td>
                        <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 text-right">{formatCurrency(item.total)}</td>
                        <td className="py-2 text-right">{formatCurrency(item.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-right text-lg font-semibold">Total: {formatCurrency(purchase.totalAmount)}</p>
            </section>

            {purchase.payable && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">Parcelas</h2>
                  <Can permission="payables.read">
                    <Link to={`/payables/${purchase.payable.id}`} className="text-sm font-medium hover:underline">
                      Ver contas a pagar
                    </Link>
                  </Can>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2">#</th>
                        <th className="py-2">Vencimento</th>
                        <th className="py-2 text-right">Valor</th>
                        <th className="py-2 text-right">Pago</th>
                        <th className="py-2 text-right">Restante</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.payable.parcels.map((parcel) => (
                        <tr key={parcel.id} className="border-b">
                          <td className="py-2">{parcel.number}</td>
                          <td className="py-2">{formatDateOnly(parcel.dueDate)}</td>
                          <td className="py-2 text-right">{formatCurrency(parcel.amount)}</td>
                          <td className="py-2 text-right">{formatCurrency(parcel.paidAmount)}</td>
                          <td className="py-2 text-right">{formatCurrency(parcel.remainingAmount)}</td>
                          <td className="py-2">{FINANCIAL_STATUS_LABELS[parcel.status] ?? parcel.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
