import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';

import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import { SalesChart } from '../components/SalesChart';
import { useDashboard } from '../hooks/useDashboard';
import type { IDashboardFinance } from '../types';

function businessDay(iso: string, plusDays = 0): string {
  const base = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
  const date = new Date(`${base}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + plusDays);

  return date.toISOString().slice(0, 10);
}

function pluralize(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ id, label, value, hint, to, danger }: { id: string; label: string; value: string; hint?: string; to?: string; danger?: boolean }) {
  const content = (
    <>
      <span className="block text-sm text-muted">{label}</span>
      <span className={`mt-1 block break-words text-xl font-semibold tabular-nums ${danger ? 'text-danger' : 'text-foreground'}`}>{value}</span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </>
  );

  return (
    <div data-testid={id} className="min-w-0 rounded-lg border border-border p-3">
      {to ? (
        <Link to={to} className="block hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

function FinanceCard({ title, base, data, from, to }: { title: string; base: string; data: IDashboardFinance; from: string; to: string }) {
  const kind = base.slice(1);

  return (
    <Card title={title}>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
        <Stat id={`${kind}-open`} label="Em aberto" value={formatCurrency(data.open)} to={`${base}?openOnly=true`} />
        <Stat id={`${kind}-overdue`} label="Vencido" value={formatCurrency(data.overdue)} to={`${base}?status=OVERDUE`} danger={data.overdue > 0} />
        <Stat
          id={`${kind}-due7`}
          label="Vencendo em 7 dias"
          value={formatCurrency(data.dueNext7Days.amount)}
          hint={pluralize(data.dueNext7Days.count, 'parcela', 'parcelas')}
          to={`${base}?openOnly=true&dueFrom=${from}&dueTo=${to}`}
        />
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();

  if (isLoading) {
    return (
      <Page>
        <div role="status" aria-live="polite" className="grid animate-pulse gap-4 md:grid-cols-2">
          <span className="sr-only">Carregando dashboard...</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-surface-muted" />
          ))}
        </div>
      </Page>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
        <p>Não foi possível carregar o dashboard.</p>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="mt-3 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
          Tentar novamente
        </button>
      </div>
    );
  }

  const from = businessDay(data.generatedAt);
  const to = businessDay(data.generatedAt, 7);
  const { sales, receivables, payables, inventory, purchases } = data;

  return (
    <Page>
      <PageHeader title="Dashboard" description="Resumo de vendas, financeiro, estoque e compras." />
      <div className="grid gap-4 lg:grid-cols-2">
        {sales && (
          <div className="lg:col-span-2">
            <Card title="Vendas">
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat id="sales-today" label="Hoje" value={formatCurrency(sales.today.total)} hint={pluralize(sales.today.count, 'venda', 'vendas')} />
                <Stat id="sales-month" label="Mês" value={formatCurrency(sales.month.total)} hint={pluralize(sales.month.count, 'venda', 'vendas')} />
              </div>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-foreground">Últimos 7 dias</h3>
                  <SalesChart days={sales.last7Days} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-foreground">Mais vendidos no mês</h3>
                  {sales.topVariants.length === 0 ? (
                    <p className="text-sm text-muted">Nenhuma venda no período.</p>
                  ) : (
                    <ol className="space-y-1 text-sm">
                      {sales.topVariants.map((item) => (
                        <li key={item.productVariantId} className="flex justify-between gap-2">
                          <span>{item.label}</span>
                          <span className="text-muted">
                            {item.quantity} un. · {formatCurrency(item.total)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {receivables && <FinanceCard title="Contas a receber" base="/receivables" data={receivables} from={from} to={to} />}
        {payables && <FinanceCard title="Contas a pagar" base="/payables" data={payables} from={from} to={to} />}

        {inventory && (
          <Card title="Estoque">
            <p className="mb-2 text-sm text-muted">{pluralize(inventory.outOfStockCount, 'variante sem estoque', 'variantes sem estoque')}</p>
            {inventory.outOfStock.length > 0 && (
              <ul className="mb-4 space-y-1 text-sm">
                {inventory.outOfStock.map((item) => (
                  <li key={item.productVariantId}>
                    <Link to="/inventory" className="hover:underline">
                      {item.label}
                    </Link>{' '}
                    <span className="text-muted">{item.quantity < 0 ? `−${Math.abs(item.quantity)}` : item.quantity} un.</span>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mb-1 text-sm font-medium text-foreground">Lotes vencendo em 30 dias ({inventory.expiringLots.count})</h3>
            {inventory.expiringLots.items.length === 0 ? (
              <p className="text-sm text-muted">Nenhum lote vencendo.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {inventory.expiringLots.items.map((lot) => (
                  <li key={lot.lotId}>
                    <Link to="/inventory" className="hover:underline">
                      {lot.label}
                    </Link>{' '}
                    <span className="text-muted">
                      {lot.batchNumber ? `lote ${lot.batchNumber} · ` : ''}vence em {formatDateOnly(lot.expirationDate)} · {lot.remainingQuantity} un.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {purchases && (
          <Card title="Compras">
            <Stat
              id="purchases-awaiting"
              label="Aguardando recebimento"
              value={pluralize(purchases.awaitingReceipt.count, 'pedido', 'pedidos')}
              hint={formatCurrency(purchases.awaitingReceipt.total)}
              to="/purchases"
            />
          </Card>
        )}
      </div>
    </Page>
  );
}
