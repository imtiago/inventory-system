import type { InventoryLot, ProductVariant } from '../types/InitialInventoryTypes';

interface Props {
  variant: ProductVariant;
  barcode: string;

  lots: InventoryLot[];
  lotsLoading: boolean;
  lotsError: string | null;

  selectedLotId: string | null;
  selectedLot: InventoryLot | null;

  lotConfirmed: boolean;

  onSelectLot(lotId: string): void;
  onConfirmLot(): void;
  onCreateNewLot(): void;
}

export function InitialInventoryLotStep({ variant, barcode, lots, lotsLoading, lotsError, selectedLotId, selectedLot, lotConfirmed, onSelectLot, onConfirmLot, onCreateNewLot }: Props) {
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

          <p>
            <strong>Código de barras:</strong> {barcode}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <label htmlFor="inventory-lot" className="mb-2 block font-medium">
          Lote
        </label>

        <select
          id="inventory-lot"
          value={selectedLotId ?? ''}
          disabled={lotsLoading || lotConfirmed}
          onChange={(event) => onSelectLot(event.target.value)}
          className="w-full rounded-lg border p-3 disabled:bg-gray-100"
        >
          <option value="">Selecione um lote</option>

          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.batchNumber ?? 'Sem lote'}
              {lot.expirationDate ? ` - Validade: ${new Date(lot.expirationDate).toLocaleDateString('pt-BR')}` : ''}
            </option>
          ))}
        </select>

        {lotsLoading && <p className="mt-2 text-sm text-gray-500">Carregando lotes...</p>}

        {lotsError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{lotsError}</div>}

        {!lotsLoading && lots.length === 0 && !lotConfirmed && <p className="mt-3 text-sm text-gray-500">Nenhum lote cadastrado para esta variante.</p>}

        {!lotConfirmed && !selectedLot && (
          <button type="button" onClick={onCreateNewLot} className="mt-4 rounded-lg border px-5 py-3">
            Criar novo lote
          </button>
        )}

        {!lotConfirmed && selectedLot && (
          <button type="button" onClick={onConfirmLot} className="mt-4 rounded-lg bg-black px-5 py-3 text-white">
            Confirmar lote
          </button>
        )}

        {lotConfirmed && selectedLot && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            Lote confirmado: <strong>{selectedLot.batchNumber ?? 'Sem lote'}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
