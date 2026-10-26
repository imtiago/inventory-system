import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { StatusBadge } from '@/components/ui/badge';
import { Page } from '@/shared/components/layout/Page';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { ReversePaymentModal } from '../components/ReversePaymentModal';
import { FINANCE_KINDS, partyOf, type FinanceKind } from '../config';
import { useFinanceDocument } from '../hooks/useFinanceDocument';
import { PAYMENT_METHOD_LABELS, FINANCE_STATUS_LABELS, type IFinancePayment } from '../types';
import { Can } from '@/shared/auth/Can';

function formatDateTime(value: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function FinanceDetailPage({ kind }: { kind: FinanceKind }) {
  const config = FINANCE_KINDS[kind];
  const { id } = useParams<{ id: string }>();
  const { data: document, isLoading, isError, error } = useFinanceDocument(kind, id);
  const [payingParcelId, setPayingParcelId] = useState<string | null>(null);
  const [reversing, setReversing] = useState<IFinancePayment | null>(null);

  const parsed = isError ? parseApiErrorSync(error) : null;
  const isNotFound = parsed?.status === 404 || parsed?.code === 'FINANCIAL_DOCUMENT_NOT_FOUND';
  const canceled = document?.status === 'CANCELED';
  const payingParcel = document?.parcels.find((p) => p.id === payingParcelId) ?? null;

  return (
    <Page>
      <div className="flex-1 overflow-y-auto p-4">
        <Link to={config.basePath} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:underline">
          <ArrowLeft size={16} />
          Voltar para {config.plural}
        </Link>

        {isLoading && <p className="text-sm text-muted">Carregando {config.singular.toLowerCase()}...</p>}

        {isError && !document && (
          <div className="rounded-lg border border-danger/30 p-6 text-sm text-danger">{isNotFound ? `${config.singular} não encontrada.` : `Não foi possível carregar a ${config.singular.toLowerCase()}.`}</div>
        )}

        {document && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">{config.singular} #{document.id.slice(0, 8).toUpperCase()}</h1>
                <p className="text-sm text-muted">{formatDateTime(document.createdAt)}</p>
                <div className="mt-2">
                  <StatusBadge status={document.displayStatus}>{FINANCE_STATUS_LABELS[document.displayStatus] ?? document.displayStatus}</StatusBadge>
                </div>
              </div>
              {document.originType === config.originType && (
                <Link to={config.originHref(document)} className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
                  {config.originDetailText(document)}
                </Link>
              )}
            </div>

            <dl className="grid gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-sm text-muted">{config.partyLabel}</dt>
                <dd className="font-medium">{partyOf(kind, document)?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Total</dt>
                <dd className="font-medium">{formatCurrency(document.totalAmount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Pago</dt>
                <dd className="font-medium">{formatCurrency(document.paidAmount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Saldo</dt>
                <dd className="font-medium">{formatCurrency(document.remainingAmount)}</dd>
              </div>
            </dl>

            <section className="flex flex-col gap-4">
              <h2 className="font-semibold">Parcelas</h2>
              {document.parcels.map((parcel) => (
                <div key={parcel.id} data-testid={`parcel-${parcel.number}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium">Parcela {parcel.number}</h3>
                      <p className="text-sm text-muted">
                        Vencimento {formatDateOnly(parcel.dueDate)} · Valor {formatCurrency(parcel.amount)} · Pago {formatCurrency(parcel.paidAmount)} · Restante{' '}
                        {formatCurrency(parcel.remainingAmount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={parcel.status}>{FINANCE_STATUS_LABELS[parcel.status] ?? parcel.status}</StatusBadge>
                      <Can permission={config.pay}>
                        <button
                          type="button"
                          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
                          disabled={canceled || parcel.status === 'PAID'}
                          onClick={() => setPayingParcelId(parcel.id)}
                        >
                          Registrar pagamento
                        </button>
                      </Can>
                    </div>
                  </div>

                  {parcel.payments.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2 border-t pt-3">
                      {parcel.payments.map((payment) => {
                        const reversed = Boolean(payment.reversedAt);

                        return (
                          <li key={payment.id} data-testid={`payment-${payment.id}`} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                            <div>
                              <p className={reversed ? 'text-muted line-through' : ''}>
                                {formatCurrency(payment.amount)} · {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method} · {formatDateOnly(payment.paymentDate)}
                                {payment.reference ? ` · ${payment.reference}` : ''}
                                {payment.createdBy ? ` · por ${payment.createdBy.name}` : ''}
                              </p>
                              {reversed && (
                                <p className="text-xs text-danger">
                                  Estornado em {formatDateTime(payment.reversedAt)} por {payment.reversedBy?.name ?? '—'}: {payment.reversalReason ?? '—'}
                                </p>
                              )}
                            </div>
                            {!reversed && !canceled && (
                              <Can permission={config.reverse}>
                                <button type="button" className="rounded-lg border px-3 py-1 text-sm hover:bg-surface-muted" onClick={() => setReversing(payment)}>
                                  Estornar
                                </button>
                              </Can>
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

      {document && payingParcel && <RegisterPaymentModal kind={kind} key={payingParcel.id} documentId={document.id} parcel={payingParcel} onClose={() => setPayingParcelId(null)} />}
      {document && reversing && <ReversePaymentModal kind={kind} key={reversing.id} documentId={document.id} payment={reversing} onClose={() => setReversing(null)} />}
    </Page>
  );
}
