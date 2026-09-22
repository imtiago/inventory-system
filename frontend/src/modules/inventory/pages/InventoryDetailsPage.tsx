import { ArrowLeft, Package, Barcode, Layers3 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useInventoryById } from '../hooks/useInventoryById';
import { useInventoryLots } from '../hooks/useInventoryLots';

export function InventoryDetailsPage() {
  const navigate = useNavigate();
  const { id: inventoryId } = useParams<{ id: string }>();

  /*
   * Aqui precisamos ter acesso ao Inventory selecionado.
   *
   * Como o endpoint de lotes precisa do productVariantId,
   * a página deve receber o inventory ou buscar novamente
   * o inventory pelo ID.
   *
   * Neste exemplo, consideramos que você possui um hook
   * useInventoryById.
   */
  const { data: inventory, isLoading: isLoadingInventory, isError: isInventoryError } = useInventoryById(inventoryId || '');

  const productVariantId = inventory?.productVariantId;

  const { data: lotsResponse, isLoading: isLoadingLots, isError: isLotsError } = useInventoryLots(productVariantId ?? '');

  const lots = lotsResponse?.data ?? [];

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
          <h1 className="text-2xl font-semibold">{variant.name}</h1>

          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <Package size={15} />
              Código: {variant.code}
            </span>

            <span className="inline-flex items-center gap-2">
              <Barcode size={15} />
              Código de barras: {variant.barcode ?? 'Não informado'}
            </span>
          </div>
        </div>
      </div>

      {/* Stock summary */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">Estoque</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <StockCard label="Total" value={inventory.quantity} />

          <StockCard label="Reservado" value={inventory.reservedQuantity} />

          <StockCard label="Disponível" value={inventory.availableQuantity} />
        </div>
      </section>

      {/* Lots */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Lotes</h2>

            <p className="text-muted-foreground text-sm">
              {lotsResponse?.pagination.total ?? 0} {lotsResponse?.pagination.total === 1 ? 'lote cadastrado' : 'lotes cadastrados'}
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

                  <th className="px-4 py-3 text-left text-sm font-medium">Validade</th>
                </tr>
              </thead>

              <tbody>
                {lots
                  .slice()
                  .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())
                  .map((lot) => (
                    <tr key={lot.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 text-sm font-medium">{lot.batchNumber}</td>

                      <td className="text-muted-foreground px-4 py-3 text-sm">{formatDate(lot.expirationDate)}</td>
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
  value: number;
}

function StockCard({ label, value }: StockCardProps) {
  return (
    <div className="bg-card rounded-lg border p-5">
      <p className="text-muted-foreground text-sm">{label}</p>

      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}
