import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Page } from '@/shared/components/layout/Page';
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

const saleStatusLabels: Record<string, string> = {
  COMPLETED: 'Concluída',
  CANCELED: 'Cancelada',
  PENDING: 'Pendente',
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sale, isLoading, isError, error: loadError } = useSale(id);
  const queryClient = useQueryClient();
  const cancel = useCancelSale(id ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  return (
    <Page>
      <div className="flex-1 overflow-y-auto p-4">
        <Link to="/sales" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:underline">
          <ArrowLeft size={16} />
          Voltar para vendas
        </Link>

        {isLoading && <p className="text-sm text-gray-500">Carregando venda...</p>}

        {isError && (
          <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">
            {isNotFound ? 'Venda não encontrada.' : 'Não foi possível carregar a venda.'}
          </div>
        )}

        {sale && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">Venda #{sale.id.slice(0, 8).toUpperCase()}</h1>
                <p className="text-sm text-gray-500">{formatDateTime(sale.createdAt)}</p>
                <span className="mt-2 inline-block rounded-full border px-3 py-1 text-xs font-medium">{saleStatusLabels[sale.status] ?? sale.status}</span>
              </div>

              {sale.status !== 'CANCELED' && hasPayments && (
                <Can permission="sales.cancel">
                  <p data-testid="cancel-blocked" className="max-w-xs text-sm text-gray-600">
                    Esta venda tem pagamento registrado. Estorne os pagamentos em contas a receber para poder cancelá-la.
                  </p>
                </Can>
              )}
              {sale.status !== 'CANCELED' && !hasPayments && (
                <Can permission="sales.cancel">
                <button
                  type="button"
                  className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                  onClick={() => {
                    setCancelError(null);
                    setConfirmOpen(true);
                  }}
                >
                  Cancelar venda
                </button>
                </Can>
              )}
            </div>

            {cancelError && (
              <div role="alert" className="rounded-lg border border-red-200 p-4 text-sm text-red-600">
                {cancelError}
              </div>
            )}

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">Cliente</dt>
                <dd className="font-medium">{sale.customer.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Vendedor</dt>
                <dd className="font-medium">{sale.seller?.name ?? '—'}</dd>
              </div>
            </dl>

            <section>
              <h2 className="mb-2 font-semibold">Itens</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2">Produto</th>
                      <th className="py-2 text-right">Qtd.</th>
                      <th className="py-2 text-right">Preço unit.</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">
                          <div className="font-medium">{item.productVariant.name}</div>
                          <div className="text-xs text-gray-500">{item.productVariant.code}</div>
                        </td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 text-right">{formatCurrency(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-right text-lg font-semibold">Total: {formatCurrency(sale.totalAmount)}</p>
            </section>

            {sale.receivable && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">Parcelas</h2>
                  <Link to={`/receivables/${sale.receivable.id}`} className="text-sm font-medium hover:underline">
                    Ver contas a receber
                  </Link>
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
                      {sale.receivable.parcels.map((parcel, index) => (
                        <tr key={parcel.id} className="border-b">
                          <td className="py-2">{index + 1}</td>
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

      <Modal open={confirmOpen} onClose={closeDialog} busy={cancel.isPending} title="Cancelar venda" description="O estoque será devolvido e a conta a receber cancelada. Deseja continuar?" size="sm">
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 hover:bg-gray-100 disabled:opacity-50" onClick={closeDialog} disabled={cancel.isPending}>
            Voltar
          </button>
          <button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50" onClick={handleConfirm} disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </Modal>
    </Page>
  );
}
