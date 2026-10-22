import { ArrowLeft, Package, Barcode, Layers3 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useInventoryById } from '../hooks/useInventoryById';
import { useInventoryLots } from '../hooks/useInventoryLots';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

export function InventoryDetailsPage() {
  const navigate = useNavigate();
  const { id: inventoryId } = useParams<{ id: string }>();

  const { data: inventory, isLoading: isLoadingInventory, isError: isInventoryError } = useInventoryById(inventoryId || '');

  const { lots, pagination, isLoading: isLoadingLots, error: lotsError } = useInventoryLots(inventory?.productVariantId, { limit: 100 });
  const isLotsError = Boolean(lotsError);

  if (isLoadingInventory) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground text-sm">Carregando estoque...</span>
      </div>
    );
  }

  if (isInventoryError || !inventory) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/inventory')} className="text-muted-foreground inline-flex items-center gap-2 text-sm hover:text-foreground">
          <ArrowLeft size={16} />
          Voltar para estoque
        </button>

        <div className="rounded-lg border p-6">
          <p className="text-destructive text-sm">Não foi possível carregar os dados do estoque.</p>
        </div>
      </div>
    );
  }

  const variant = inventory.productVariant;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/inventory')} className="text-muted-foreground inline-flex items-center gap-2 text-sm transition-colors hover:text-foreground">
          <ArrowLeft size={16} />
          Voltar para estoque
        </button>

        <div>
          <h1 className="text-2xl font-semibold">{variant?.name}</h1>

          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <Package size={15} />
              Código: {variant?.code}
            </span>

            <span className="inline-flex items-center gap-2">
              <Barcode size={15} />
              Código de barras: {variant?.barcode ?? 'Não informado'}
            </span>
          </div>
        </div>
      </div>

      {/* Stock summary */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">Estoque</h2>

        <div className="grid gap-4 sm:grid-cols-4">
          <StockCard label="Saldo" value={inventory.quantity} />

          <StockCard label="Reservado" value={inventory.reservedQuantity} />

          <StockCard label="Disponível" value={inventory.availableQuantity} />

          <StockCard label="Custo médio" value={formatCurrency(inventory.averageCost)} />
        </div>
      </section>

      {/* Lots */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Lotes</h2>

            <p className="text-muted-foreground text-sm">
              {pagination?.total ?? 0} {pagination?.total === 1 ? 'lote cadastrado' : 'lotes cadastrados'}
            </p>
          </div>

          <Layers3 size={20} className="text-muted-foreground" />
        </div>

        {isLoadingLots ? (
          <div className="rounded-lg border p-8 text-center">
            <span className="text-muted-foreground text-sm">Carregando lotes...</span>
          </div>
        ) : isLotsError ? (
          <div className="rounded-lg border p-6">
            <p className="text-destructive text-sm">Não foi possível carregar os lotes.</p>
          </div>
        ) : lots.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <p className="text-muted-foreground text-sm">Nenhum lote cadastrado para esta variante.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium">Lote</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Recebido</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Restante</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Em caixas</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Custo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Validade</th>
                </tr>
              </thead>

              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 text-sm font-medium">{lot.batchNumber ?? 'Sem lote'}</td>
                    <td className="px-4 py-3 text-sm">{lot.initialQuantity}</td>
                    <td className="px-4 py-3 text-sm">{lot.remainingQuantity}</td>
                    <td className="px-4 py-3 text-sm">{lot.allocatedQuantity}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(lot.unitCost)}</td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">{formatDateOnly(lot.expirationDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

interface StockCardProps {
  label: string;
  value: number | string;
}

function StockCard({ label, value }: StockCardProps) {
  return (
    <div className="bg-card rounded-lg border p-5">
      <p className="text-muted-foreground text-sm">{label}</p>

      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}
