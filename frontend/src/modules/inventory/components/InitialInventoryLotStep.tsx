import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import type { InventoryLot, ProductVariant } from '../types';

interface Props {
  variant: ProductVariant;
  barcode: string;

  lots: InventoryLot[];
  lotsLoading: boolean;
  lotsError: string | null;

  selectedLotId: string | null;
  selectedLot: InventoryLot | null;

  onSelectLot(lotId: string): void;
  onConfirmLot(): void;
  onCreateNewLot(): void;
  onBack(): void;
}

function lotLabel(lot: InventoryLot) {
  const validity = lot.expirationDate ? ` — validade ${formatDateOnly(lot.expirationDate)}` : '';

  return `${lot.batchNumber ?? 'Sem lote'} — restante ${lot.remainingQuantity}, em caixas ${lot.allocatedQuantity}${validity}`;
}

export function InitialInventoryLotStep({ variant, barcode, lots, lotsLoading, lotsError, selectedLotId, selectedLot, onSelectLot, onConfirmLot, onCreateNewLot, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface p-6 shadow">
        <h2 className="text-xl font-semibold">Selecionar lote</h2>

        <div className="mt-4 space-y-1 text-sm text-muted">
          <p>
            <strong>Variante:</strong> {variant.name}
          </p>

          <p>
            <strong>Código:</strong> {variant.code}
          </p>

          {(barcode || variant.barcode) && (
            <p>
              <strong>Código de barras:</strong> {barcode || variant.barcode}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-surface p-6 shadow">
        <label htmlFor="inventory-lot" className="mb-2 block font-medium">
          Lote
        </label>

        <select
          id="inventory-lot"
          value={selectedLotId ?? ''}
          disabled={lotsLoading}
          onChange={(event) => onSelectLot(event.target.value)}
          className="w-full rounded-lg border border-input bg-surface text-foreground p-3 disabled:bg-surface-muted"
        >
          <option value="">Selecione um lote</option>

          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lotLabel(lot)}
            </option>
          ))}
        </select>

        {lotsLoading && <p className="mt-2 text-sm text-muted">Carregando lotes...</p>}

        {lotsError && (
          <div role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            {lotsError}
          </div>
        )}

        {!lotsLoading && !lotsError && lots.length === 0 && <p className="mt-3 text-sm text-muted">Nenhum lote cadastrado para esta variante.</p>}

        {selectedLot && (
          <p className="mt-3 text-sm text-muted">
            Restante: <strong>{selectedLot.remainingQuantity}</strong> · Em caixas: <strong>{selectedLot.allocatedQuantity}</strong>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={onBack} className="rounded-lg border border-input bg-surface text-foreground px-5 py-3">
            Voltar
          </button>

          <button type="button" onClick={onCreateNewLot} className="rounded-lg border border-input bg-surface text-foreground px-5 py-3">
            Criar novo lote
          </button>

          <button type="button" onClick={onConfirmLot} disabled={!selectedLot} className="rounded-lg bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50">
            Confirmar lote
          </button>
        </div>
      </div>
    </div>
  );
}
