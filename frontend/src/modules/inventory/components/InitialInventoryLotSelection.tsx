import type { InventoryLot } from '../types/InitialInventoryTypes';

interface InitialInventoryLotSelectionProps {
  lots: InventoryLot[];
  selectedLot: InventoryLot | null;
  confirmed: boolean;
  onSelectLot: (lot: InventoryLot) => void;
  onConfirm: () => void;
  onCreateNew: () => void;
  onChangeLot: () => void;
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) {
    return '-';
  }

  return new Date(date).toLocaleDateString('pt-BR');
}

export function InitialInventoryLotSelection({ lots, selectedLot, confirmed, onSelectLot, onConfirm, onCreateNew, onChangeLot }: InitialInventoryLotSelectionProps) {
  if (confirmed && selectedLot) {
    return (
      <div className="space-y-5 rounded-xl bg-white p-6 shadow">
        <div>
          <h2 className="text-xl font-bold">Lote confirmado</h2>

          <p className="mt-1 text-sm text-gray-500">O lote abaixo será utilizado para o lançamento do estoque.</p>
        </div>

        <div className="space-y-2 rounded-lg border bg-gray-50 p-4">
          <div>
            <p className="text-xs text-gray-500">Número do lote</p>

            <p className="font-semibold">{selectedLot.batchNumber ?? 'Sem número'}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500">Data de validade</p>

            <p className="font-semibold">{formatDate(selectedLot.expirationDate)}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500">Quantidade disponível</p>

            <p className="font-semibold">{selectedLot.remainingQuantity}</p>
          </div>
        </div>

        <button type="button" onClick={onChangeLot} className="rounded-lg border px-5 py-3 font-medium hover:bg-gray-50">
          Alterar lote
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl bg-white p-6 shadow">
      <div>
        <h2 className="text-xl font-bold">Selecionar lote</h2>

        <p className="mt-1 text-sm text-gray-500">Selecione um lote existente ou crie um novo lote.</p>
      </div>

      <div>
        <label htmlFor="inventory-lot" className="mb-1 block text-sm font-medium">
          Lote
        </label>

        <select
          id="inventory-lot"
          value={selectedLot?.id ?? ''}
          onChange={(event) => {
            const lot = lots.find((item) => item.id === event.target.value);

            if (lot) {
              onSelectLot(lot);
            }
          }}
          className="w-full rounded-lg border p-3"
        >
          <option value="">Selecione um lote...</option>

          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.batchNumber ?? 'Sem número'}
              {' - '}
              Val.: {formatDate(lot.expirationDate)}
            </option>
          ))}
        </select>
      </div>

      {selectedLot && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Lote selecionado</p>

          <p className="font-semibold">{selectedLot.batchNumber ?? 'Sem número'}</p>

          <p className="mt-1 text-sm text-gray-500">Validade: {formatDate(selectedLot.expirationDate)}</p>

          <p className="text-sm text-gray-500">Estoque atual: {selectedLot.remainingQuantity}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button type="button" onClick={onConfirm} disabled={!selectedLot} className="rounded-lg bg-black px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
          Confirmar lote
        </button>

        <button type="button" onClick={onCreateNew} className="rounded-lg border px-5 py-3 font-medium hover:bg-gray-50">
          + Criar novo lote
        </button>
      </div>
    </div>
  );
}
