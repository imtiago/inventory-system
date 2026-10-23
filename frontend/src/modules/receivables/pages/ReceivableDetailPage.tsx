import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { CrudBadge } from '@/shared/components/crud';
import { Page } from '@/shared/components/layout/Page';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { ReversePaymentModal } from '../components/ReversePaymentModal';
import { useReceivable } from '../hooks/useReceivable';
import { PAYMENT_METHOD_LABELS, RECEIVABLE_STATUS_LABELS, type IReceivablePayment } from '../types';

function formatDateTime(value: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function ReceivableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: receivable, isLoading, isError, error } = useReceivable(id);
  const [payingParcelId, setPayingParcelId] = useState<string | null>(null);
  const [reversing, setReversing] = useState<IReceivablePayment | null>(null);

  const parsed = isError ? parseApiErrorSync(error) : null;
  const isNotFound = parsed?.status === 404 || parsed?.code === 'FINANCIAL_DOCUMENT_NOT_FOUND';
  const canceled = receivable?.status === 'CANCELED';
  const payingParcel = receivable?.parcels.find((p) => p.id === payingParcelId) ?? null;

  return (
    <Page>
      <div className="flex-1 overflow-y-auto p-4">
        <Link to="/receivables" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:underline">
          <ArrowLeft size={16} />
          Voltar para contas a receber
        </Link>

        {isLoading && <p className="text-sm text-gray-500">Carregando conta a receber...</p>}

        {isError && !receivable && (
          <div className="rounded-lg border border-red-200 p-6 text-sm text-red-600">{isNotFound ? 'Conta a receber não encontrada.' : 'Não foi possível carregar a conta a receber.'}</div>
        )}

        {receivable && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">Conta a receber #{receivable.id.slice(0, 8).toUpperCase()}</h1>
                <p className="text-sm text-gray-500">{formatDateTime(receivable.createdAt)}</p>
                <div className="mt-2">
                  <CrudBadge>{RECEIVABLE_STATUS_LABELS[receivable.displayStatus] ?? receivable.displayStatus}</CrudBadge>
                </div>
              </div>
              {receivable.originType === 'SALE' && (
                <Link to={`/sales/${receivable.originId}`} className="text-sm font-medium hover:underline">
                  Venda de origem
                </Link>
              )}
            </div>

            <dl className="grid gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-sm text-gray-500">Cliente</dt>
                <dd className="font-medium">{receivable.customer.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Total</dt>
                <dd className="font-medium">{formatCurrency(receivable.totalAmount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Pago</dt>
                <dd className="font-medium">{formatCurrency(receivable.paidAmount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Saldo</dt>
                <dd className="font-medium">{formatCurrency(receivable.remainingAmount)}</dd>
              </div>
            </dl>

            <section className="flex flex-col gap-4">
              <h2 className="font-semibold">Parcelas</h2>
              {receivable.parcels.map((parcel) => (
                <div key={parcel.id} data-testid={`parcel-${parcel.number}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium">Parcela {parcel.number}</h3>
                      <p className="text-sm text-gray-500">
                        Vencimento {formatDateOnly(parcel.dueDate)} · Valor {formatCurrency(parcel.amount)} · Pago {formatCurrency(parcel.paidAmount)} · Restante{' '}
                        {formatCurrency(parcel.remainingAmount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <CrudBadge>{RECEIVABLE_STATUS_LABELS[parcel.status] ?? parcel.status}</CrudBadge>
                      <button
                        type="button"
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={canceled || parcel.status === 'PAID'}
                        onClick={() => setPayingParcelId(parcel.id)}
                      >
                        Registrar pagamento
                      </button>
                    </div>
                  </div>

                  {parcel.payments.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2 border-t pt-3">
                      {parcel.payments.map((payment) => {
                        const reversed = Boolean(payment.reversedAt);

                        return (
                          <li key={payment.id} data-testid={`payment-${payment.id}`} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                            <div>
                              <p className={reversed ? 'text-gray-400 line-through' : ''}>
                                {formatCurrency(payment.amount)} · {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method} · {formatDateOnly(payment.paymentDate)}
                                {payment.reference ? ` · ${payment.reference}` : ''}
                                {payment.createdBy ? ` · por ${payment.createdBy.name}` : ''}
                              </p>
                              {reversed && (
                                <p className="text-xs text-red-600">
                                  Estornado em {formatDateTime(payment.reversedAt)} por {payment.reversedBy?.name ?? '—'}: {payment.reversalReason ?? '—'}
                                </p>
                              )}
                            </div>
                            {!reversed && !canceled && (
                              <button type="button" className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-100" onClick={() => setReversing(payment)}>
                                Estornar
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          </div>
        )}
      </div>

      {receivable && payingParcel && <RegisterPaymentModal key={payingParcel.id} receivableId={receivable.id} parcel={payingParcel} onClose={() => setPayingParcelId(null)} />}
      {receivable && reversing && <ReversePaymentModal key={reversing.id} receivableId={receivable.id} payment={reversing} onClose={() => setReversing(null)} />}
    </Page>
  );
}
