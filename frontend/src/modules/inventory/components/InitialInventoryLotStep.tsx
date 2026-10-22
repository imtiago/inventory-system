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
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">Selecionar lote</h2>

        <div className="mt-4 space-y-1 text-sm text-gray-600">
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

      <div className="rounded-xl bg-white p-6 shadow">
        <label htmlFor="inventory-lot" className="mb-2 block font-medium">
          Lote
        </label>

        <select
          id="inventory-lot"
          value={selectedLotId ?? ''}
          disabled={lotsLoading}
          onChange={(event) => onSelectLot(event.target.value)}
          className="w-full rounded-lg border p-3 disabled:bg-gray-100"
        >
          <option value="">Selecione um lote</option>

          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lotLabel(lot)}
            </option>
          ))}
        </select>

        {lotsLoading && <p className="mt-2 text-sm text-gray-500">Carregando lotes...</p>}

        {lotsError && (
          <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {lotsError}
          </div>
        )}

        {!lotsLoading && !lotsError && lots.length === 0 && <p className="mt-3 text-sm text-gray-500">Nenhum lote cadastrado para esta variante.</p>}

        {selectedLot && (
          <p className="mt-3 text-sm text-gray-600">
            Restante: <strong>{selectedLot.remainingQuantity}</strong> · Em caixas: <strong>{selectedLot.allocatedQuantity}</strong>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={onBack} className="rounded-lg border px-5 py-3">
            Voltar
          </button>

          <button type="button" onClick={onCreateNewLot} className="rounded-lg border px-5 py-3">
            Criar novo lote
          </button>

          <button type="button" onClick={onConfirmLot} disabled={!selectedLot} className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50">
            Confirmar lote
          </button>
        </div>
      </div>
    </div>
  );
}
