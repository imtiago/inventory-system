import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { StatusBadge } from '@/components/ui/badge';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/details/Section';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { ReversePaymentModal } from '../components/ReversePaymentModal';
import { FINANCE_KINDS, partyOf, type FinanceKind } from '../config';
import { useFinanceDocument } from '../hooks/useFinanceDocument';
import { PAYMENT_METHOD_LABELS, FINANCE_STATUS_LABELS, type IFinancePayment } from '../types';
import { Can } from '@/shared/auth/Can';
import { PdfDocumentButton } from '@/modules/credit/components/PdfDocumentButton';
import { LoadingState } from '@/shared/components/LoadingState';
import { formatDateTime } from '@/shared/utils/formatDateTime';

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
    <Page width="narrow">
      <PageHeader
        title={document ? `${config.singular} #${document.id.slice(0, 8).toUpperCase()}` : config.singular}
        description={document ? formatDateTime(document.createdAt) : undefined}
        meta={document ? <StatusBadge status={document.displayStatus}>{FINANCE_STATUS_LABELS[document.displayStatus] ?? document.displayStatus}</StatusBadge> : undefined}
        backPath={config.basePath}
        backLabel={config.plural}
        actions={
          document && document.originType === config.originType ? (
            <Link to={config.originHref(document)} className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
              {config.originDetailText(document)}
            </Link>
          ) : undefined
        }
      />

      {isLoading && <LoadingState label={`Carregando ${config.singular.toLowerCase()}...`} />}

      {isError && !document && (
        <div className="rounded-lg border border-danger/30 p-6 text-sm text-danger">{isNotFound ? `${config.singular} não encontrada.` : `Não foi possível carregar a ${config.singular.toLowerCase()}.`}</div>
      )}

      {document && (
        <>
          <Section title="Resumo">
            <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
              <div>
                <dt className="text-sm text-muted">{config.partyLabel}</dt>
                <dd className="font-medium">{partyOf(kind, document)?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Total</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(document.totalAmount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Pago</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(document.paidAmount)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Saldo</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(document.remainingAmount)}</dd>
              </div>
            </dl>
          </Section>

          {kind === 'receivable' && document.noLateFees && (
            <p className="rounded-xl border border-border bg-surface-muted p-3 text-sm text-muted">Sem multa nem juros de atraso: conta anterior ao crediário.</p>
          )}

          <Section title="Parcelas">
            <div className="flex flex-col gap-4 p-4 sm:p-6">
              {document.parcels.map((parcel) => (
                <div key={parcel.id} data-testid={`parcel-${parcel.number}`} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium">Parcela {parcel.number}</h3>
                      <p className="text-sm text-muted">
                        Vencimento {formatDateOnly(parcel.dueDate)} · Valor {formatCurrency(parcel.amount)} · Pago {formatCurrency(parcel.paidAmount)} · Restante{' '}
                        {formatCurrency(parcel.remainingAmount)}
                      </p>
                      {!canceled && parcel.remainingAmount > 0 && parcel.lateFeesToday && parcel.lateFeesToday.fine + parcel.lateFeesToday.interest > 0 && (
                        <p className="text-sm font-medium text-warning">
                          Se paga hoje: multa {formatCurrency(parcel.lateFeesToday.fine)} · juros {formatCurrency(parcel.lateFeesToday.interest)} · total{' '}
                          {formatCurrency(parcel.lateFeesToday.totalDue)}
                        </p>
                      )}
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
                    <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
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
                              {payment.backdateReason && <p className="text-xs text-muted">Data passada: {payment.backdateReason}</p>}
                              <PaymentFees payment={payment} />
                              {reversed && (
                                <p className="text-xs text-danger">
                                  Estornado em {formatDateTime(payment.reversedAt)} por {payment.reversedBy?.name ?? '—'}: {payment.reversalReason ?? '—'}
                                </p>
                              )}
                            </div>
                            {!reversed && (
                              <div className="flex flex-wrap items-start gap-2">
                                {kind === 'receivable' && (
                                  <PdfDocumentButton label="Recibo" ariaLabel={`Recibo do pagamento de ${formatCurrency(payment.amount)}`} url={`/receivables/payments/${payment.id}/receipt.pdf`} fileName={`recibo-${payment.id.slice(0, 8).toUpperCase()}.pdf`} />
                                )}
                                {!canceled && (
                                  <Can permission={config.reverse}>
                                    <button type="button" className="rounded-lg border px-3 py-1 text-sm hover:bg-surface-muted" onClick={() => setReversing(payment)}>
                                      Estornar
                                    </button>
                                  </Can>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {document && payingParcel && <RegisterPaymentModal kind={kind} key={payingParcel.id} documentId={document.id} parcel={payingParcel} onClose={() => setPayingParcelId(null)} />}
      {document && reversing && <ReversePaymentModal kind={kind} key={reversing.id} documentId={document.id} payment={reversing} onClose={() => setReversing(null)} />}
    </Page>
  );
}

/** Multa, juros, dispensa e recebido em caixa de um pagamento com encargos. */
function PaymentFees({ payment }: { payment: IFinancePayment }) {
  const fine = payment.fineAmount ?? 0;
  const interest = payment.interestAmount ?? 0;
  if (fine + interest <= 0) return null;
  const waived = payment.waivedAmount ?? 0;
  const parts = [`Multa ${formatCurrency(fine)}`, `Juros ${formatCurrency(interest)}`];

  return (
    <div className={`mt-0.5 text-xs ${payment.reversedAt ? 'text-muted line-through' : 'text-muted'}`}>
      <p>
        {parts.join(' · ')} · <span className="font-medium text-foreground">Recebido em caixa {formatCurrency(payment.receivedAmount)}</span>
      </p>
      {waived > 0 && (
        <p>
          Dispensado {formatCurrency(waived)}
          {payment.waivedBy ? ` por ${payment.waivedBy.name}` : ''}: {payment.waiverReason ?? '—'}
        </p>
      )}
    </div>
  );
}
