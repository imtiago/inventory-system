import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrudPagination } from '@/shared/components/crud';
import { Section } from '@/shared/components/details/Section';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingState } from '@/shared/components/LoadingState';
import { DataTable, type DataTableColumn } from '@/shared/components/table';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateTime } from '@/shared/utils/formatDateTime';
import type { Tone } from '@/shared/utils/statusTone';

import { ApproveLimitRequestModal } from '../components/ApproveLimitRequestModal';
import { RejectLimitRequestModal } from '../components/RejectLimitRequestModal';
import { useCreditLimitRequests } from '../hooks/useCredit';
import type { CreditLimitRequest, CreditRequestStatus } from '../types';

const STATUS: Record<CreditRequestStatus, { label: string; filter: string; tone: Tone }> = {
  PENDING: { label: 'Pendente', filter: 'Pendentes', tone: 'warning' },
  APPROVED: { label: 'Aprovado', filter: 'Aprovados', tone: 'success' },
  REJECTED: { label: 'Recusado', filter: 'Recusados', tone: 'danger' },
};
const STATUS_ORDER: CreditRequestStatus[] = ['PENDING', 'REJECTED', 'APPROVED'];

export function CreditRequestsPage() {
  const [status, setStatus] = useState<CreditRequestStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<CreditLimitRequest | null>(null);
  const [rejecting, setRejecting] = useState<CreditLimitRequest | null>(null);
  const { data, isLoading, isError } = useCreditLimitRequests(page, status);

  function changeStatus(next: CreditRequestStatus) {
    setStatus(next);
    setPage(1);
  }

  const columns: DataTableColumn<CreditLimitRequest>[] = [
    {
      id: 'customer',
      header: 'Cliente',
      mobile: 'title',
      cell: (r) => (
        <Link to={`/customers/${r.customer.id}`} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
          {r.customer.name}
        </Link>
      ),
    },
    {
      id: 'limit',
      header: 'Limite',
      numeric: true,
      mobile: 'meta',
      cell: (r) => (
        <>
          <div>{formatCurrency(r.approvedLimit ?? r.requestedLimit)}</div>
          <div className="text-xs font-normal text-muted">{r.approvedLimit !== null && r.approvedLimit !== r.requestedLimit ? `pedido ${formatCurrency(r.requestedLimit)} · ` : ''}atual {formatCurrency(r.currentLimit)}</div>
        </>
      ),
    },
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
          <div className="flex flex-wrap items-center gap-1">
            <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
            {r.autoApproved && <Badge tone="info">Automático</Badge>}
          </div>
          {r.decidedBy && <div className="mt-1 text-xs text-muted">{`${r.decidedBy.name}${r.decidedAt ? ` · ${formatDateTime(r.decidedAt)}` : ''}`}</div>}
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
            <Button type="button" aria-label={`Aprovar pedido de ${r.customer.name}`} className="min-h-11 lg:min-h-9" onClick={() => setApproving(r)}>
              Aprovar
            </Button>
            <Button type="button" variant="outline" aria-label={`Recusar pedido de ${r.customer.name}`} className="min-h-11 lg:min-h-9" onClick={() => setRejecting(r)}>
              Recusar
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <Page>
      <PageHeader title="Pedidos de crédito" description="Vendedores pedem aumento de limite; quem aprova pode ajustar o valor ou recusar com motivo." />

      <Section>
        <div className="flex flex-1 flex-col">
          <div role="group" aria-label="Situação" className="flex flex-wrap gap-2 border-b border-border p-4 sm:p-5">
            {STATUS_ORDER.map((s) => (
              <Button key={s} type="button" variant={status === s ? 'primary' : 'outline'} aria-pressed={status === s} className="min-h-11" onClick={() => changeStatus(s)}>
                {STATUS[s].filter}
              </Button>
            ))}
          </div>

          {isError ? (
            <div role="alert" className="m-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger sm:m-5">
              Não foi possível carregar os pedidos de aumento.
            </div>
          ) : isLoading ? (
            <LoadingState label="Carregando pedidos..." />
          ) : (
            <div className="flex-1">
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(r) => r.id} emptyMessage="Nenhum pedido de aumento" emptyHint="Quando um vendedor pedir aumento de limite de um cliente, o pedido aparece aqui." />
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

      <ApproveLimitRequestModal request={approving} onClose={() => setApproving(null)} />
      <RejectLimitRequestModal request={rejecting} onClose={() => setRejecting(null)} />
    </Page>
  );
}

export default CreditRequestsPage;
