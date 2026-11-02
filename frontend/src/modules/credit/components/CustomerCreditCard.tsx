import { useState } from 'react';
import { Pencil, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Can } from '@/shared/auth/Can';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Section } from '@/shared/components/details/Section';
import { InfoItem } from '@/shared/components/details/InfoItem';
import { LoadingState } from '@/shared/components/LoadingState';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateTime } from '@/shared/utils/formatDateTime';

import { useCustomerCredit } from '../hooks/useCredit';
import { CREDIT_PROFILE_NAMES, CREDIT_SOURCE_LABELS, CREDIT_STATUS_LABELS, type CreditHistoryEntry } from '../types';
import { CustomerCreditEditModal } from './CustomerCreditEditModal';
import { RequestLimitModal } from './RequestLimitModal';

function changesOf(entry: CreditHistoryEntry): string[] {
  const lines: string[] = [];

  if (entry.fromProfile !== entry.toProfile) lines.push(`Perfil: ${CREDIT_PROFILE_NAMES[entry.fromProfile]} → ${CREDIT_PROFILE_NAMES[entry.toProfile]}`);
  if (entry.fromLimit !== entry.toLimit) lines.push(`Limite: ${formatCurrency(entry.fromLimit)} → ${formatCurrency(entry.toLimit)}`);
  if (entry.fromStatus !== entry.toStatus) lines.push(`Situação: ${CREDIT_STATUS_LABELS[entry.fromStatus]} → ${CREDIT_STATUS_LABELS[entry.toStatus]}`);

  return lines;
}

/** Seção "Crédito" da ficha do cliente: situação atual, ajuste manual e histórico. */
export function CustomerCreditCard({ customerId }: { customerId: string }) {
  const { data: credit, isLoading, isError } = useCustomerCredit(customerId);
  const [editing, setEditing] = useState(false);
  const [requesting, setRequesting] = useState(false);

  return (
    <Section
      title="Crédito"
      description="Perfil, limite e histórico de mudanças no crediário"
      actions={
        credit && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Can permission="credit.request">
              <Button type="button" className="shrink-0 border border-input bg-surface text-foreground hover:bg-surface-muted" onClick={() => setRequesting(true)}>
                <TrendingUp size={16} className="mr-2" aria-hidden="true" />
                Pedir aumento de limite
              </Button>
            </Can>
            <Can permission="credit.manage">
              <Button type="button" className="shrink-0 border border-input bg-surface text-foreground hover:bg-surface-muted" onClick={() => setEditing(true)}>
                <Pencil size={16} className="mr-2" aria-hidden="true" />
                Ajustar
              </Button>
            </Can>
          </div>
        )
      }
    >
      {isLoading ? (
        <LoadingState label="Carregando crédito..." />
      ) : isError || !credit ? (
        <p role="alert" className="p-4 text-sm text-danger sm:p-6">
          Não foi possível carregar o crédito do cliente.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-4 sm:p-6 lg:grid-cols-5">
            <InfoItem label="Perfil" value={credit.profileName} />
            <InfoItem label="Limite" value={formatCurrency(credit.limit)} />
            <InfoItem label="Em aberto" value={formatCurrency(credit.openBalance)} />
            <InfoItem label="Disponível" value={formatCurrency(credit.available)} />
            <InfoItem label="Situação" value={<StatusBadge status={credit.status}>{CREDIT_STATUS_LABELS[credit.status]}</StatusBadge>} />
          </div>

          {credit.legacyOpenBalance > 0 && (
            <p data-testid="credit-legacy-balance" className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-2 text-sm text-muted sm:px-6">
              <StatusBadge status="LEGACY">Caderninho</StatusBadge>
              <span>
                <span className="font-medium tabular-nums text-foreground">{formatCurrency(credit.legacyOpenBalance)}</span> do valor em aberto são dívidas antigas, sem multa nem juros e que não contam como atraso.
              </span>
            </p>
          )}

          <p className="px-4 pb-4 text-sm text-muted sm:px-6">
            <Link to={`/receivables?customerId=${customerId}&openOnly=true`} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
              Ver contas a receber do cliente
            </Link>
          </p>

          {credit.currentMaxOverdueDays > 0 && (
            <p className="px-4 pb-4 text-sm text-danger sm:px-6">Parcela em atraso há {credit.currentMaxOverdueDays} dias.</p>
          )}

          <div className="border-t border-border p-4 sm:p-6">
            <h3 className="mb-3 font-semibold">Histórico</h3>

            {credit.history.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma alteração registrada.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {credit.history.map((entry) => (
                  <li key={entry.id} className="min-w-0 rounded-lg border border-border p-3">
                    <p className="text-sm text-muted">
                      {CREDIT_SOURCE_LABELS[entry.source]}
                      {entry.changedBy ? ` · ${entry.changedBy.name}` : ''} · {formatDateTime(entry.createdAt)}
                    </p>
                    {changesOf(entry).map((line) => (
                      <p key={line} className="text-sm font-medium">
                        {line}
                      </p>
                    ))}
                    <p className="mt-1 break-words text-sm">{entry.reason}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <RequestLimitModal customerId={customerId} currentLimit={credit.limit} open={requesting} onClose={() => setRequesting(false)} />
          <CustomerCreditEditModal customerId={customerId} credit={editing ? credit : null} onClose={() => setEditing(false)} />
        </>
      )}
    </Section>
  );
}
