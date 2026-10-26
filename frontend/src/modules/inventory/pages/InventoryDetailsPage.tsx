import { Package, Barcode, Layers3 } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/details/Section';

import { useInventoryById } from '../hooks/useInventoryById';
import { useInventoryLots } from '../hooks/useInventoryLots';
import { useBreakpoint } from '@/shared/hooks/useMediaQuery';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import type { InventoryLot } from '../types';

export function InventoryDetailsPage() {
  const isTabletUp = useBreakpoint('md');
  const { id: inventoryId } = useParams<{ id: string }>();

  const { data: inventory, isLoading: isLoadingInventory, isError: isInventoryError } = useInventoryById(inventoryId || '');

  const { lots, pagination, isLoading: isLoadingLots, error: lotsError } = useInventoryLots(inventory?.productVariantId, { limit: 100 });
  const isLotsError = Boolean(lotsError);

  if (isLoadingInventory) {
    return (
      <Page width="narrow">
        <PageHeader title="Estoque" backPath="/inventory" backLabel="estoque" />
        <p role="status" className="py-10 text-center text-sm text-muted">Carregando estoque...</p>
      </Page>
    );
  }

  if (isInventoryError || !inventory) {
    return (
      <Page width="narrow">
        <PageHeader title="Estoque" backPath="/inventory" backLabel="estoque" />

        <div className="rounded-lg border border-danger/30 p-6">
          <p className="text-sm text-danger">Não foi possível carregar os dados do estoque.</p>
        </div>
      </Page>
    );
  }

  const variant = inventory.productVariant;
  const today = todayInBusinessTz();

  return (
    <Page width="narrow">
      <PageHeader
        title={variant?.name ?? 'Estoque'}
        backPath="/inventory"
        backLabel="estoque"
        description={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <Package size={15} />
              Código: {variant?.code}
            </span>

            <span className="inline-flex items-center gap-2">
              <Barcode size={15} />
              Código de barras: {variant?.barcode ?? 'Não informado'}
            </span>
          </span>
        }
      />

      <Section title="Posição de estoque">
        <div className="grid grid-cols-2 gap-4 p-4 sm:p-6 lg:grid-cols-4">
          <StockCard label="Saldo" value={inventory.quantity} />

          <StockCard label="Reservado" value={inventory.reservedQuantity} />

          <StockCard label="Disponível" value={inventory.availableQuantity} />

          <StockCard label="Custo médio" value={formatCurrency(inventory.averageCost)} />

          {inventory.expired > 0 && <StockCard label="Vencido" value={`Vencido: ${inventory.expired}`} highlight />}
        </div>
      </Section>

      <Section
        title="Lotes"
        description={`${pagination?.total ?? 0} ${pagination?.total === 1 ? 'lote cadastrado' : 'lotes cadastrados'}`}
        actions={<Layers3 size={20} className="text-muted" />}
      >
        <div className="p-4 sm:p-6">
        {isLoadingLots ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <span className="text-muted text-sm">Carregando lotes...</span>
          </div>
        ) : isLotsError ? (
          <div className="rounded-lg border border-danger/30 p-6">
            <p className="text-danger text-sm">Não foi possível carregar os lotes.</p>
          </div>
        ) : lots.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <p className="text-muted text-sm">Nenhum lote cadastrado para esta variante.</p>
          </div>
        ) : !isTabletUp ? (
          <ul className="space-y-3">
            {lots.map((lot) => (
              <li key={lot.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="break-words font-medium">
                    {lot.batchNumber ?? 'Sem lote'}
                    {isLotExpired(lot, today) && <ExpiredTag />}
                  </p>
                  <p className="text-muted shrink-0 text-sm">Validade: {formatDateOnly(lot.expirationDate)}</p>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted text-xs uppercase tracking-wide">Recebido</dt>
                    <dd>{lot.initialQuantity}</dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs uppercase tracking-wide">Restante</dt>
                    <dd>{lot.remainingQuantity}</dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs uppercase tracking-wide">Em caixas</dt>
                    <dd>{lot.allocatedQuantity}</dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs uppercase tracking-wide">Custo</dt>
                    <dd>{formatCurrency(lot.unitCost)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Lote</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Recebido</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Restante</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Em caixas</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Custo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Validade</th>
                </tr>
              </thead>

              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-sm font-medium">
                      {lot.batchNumber ?? 'Sem lote'}
                      {isLotExpired(lot, today) && <ExpiredTag />}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">{lot.initialQuantity}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">{lot.remainingQuantity}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">{lot.allocatedQuantity}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">{formatCurrency(lot.unitCost)}</td>
                    <td className="text-muted px-4 py-3 text-sm">{formatDateOnly(lot.expirationDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </Section>
    </Page>
  );
}

interface StockCardProps {
  label: string;
  value: number | string;
  highlight?: boolean;
}

/** Expired = has stock and the expiration date (date-only, UTC midnight) is before today in the business timezone. */
function isLotExpired(lot: Pick<InventoryLot, 'expirationDate' | 'remainingQuantity'>, today: string) {
  return lot.remainingQuantity > 0 && lot.expirationDate !== null && lot.expirationDate.slice(0, 10) < today;
}

function ExpiredTag() {
  return <span className="ml-2 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-medium text-danger">Vencido</span>;
}

function StockCard({ label, value, highlight }: StockCardProps) {
  return (
    <div className={highlight ? 'rounded-lg border border-danger/30 bg-danger-soft p-5 text-danger' : 'rounded-lg border border-border bg-surface-muted p-5'}>
      <p className={highlight ? 'text-sm' : 'text-sm text-muted'}>{label}</p>

      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}
