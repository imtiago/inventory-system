import { useEffect, useState } from 'react';

import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { useInventoryBoxes } from '../hooks/useInventoryBox';
import type { InventoryBox, InventoryLot } from '../types';

interface Props {
  lot: InventoryLot;
  /** max(0, remainingQuantity − allocatedQuantity) */
  availableForBoxes: number;

  selectedBox: InventoryBox | null;

  loading: boolean;
  error: string | null;

  onSelectBox(box: InventoryBox): void;
  onCreateBox(): void | Promise<void>;
  onAddToBox(quantity: number): void | Promise<void>;
  onBack(): void;
}

function useDebouncedValue(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function InitialInventoryBoxStep({ lot, availableForBoxes, selectedBox, loading, error, onSelectBox, onCreateBox, onAddToBox, onBack }: Props) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { boxes, isLoading: boxesLoading, error: boxesError } = useInventoryBoxes(debouncedSearch);

  // Kept as text so the field can be cleared while typing; validated on submit.
  const [quantity, setQuantity] = useState('1');

  const noRoom = availableForBoxes === 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    void onAddToBox(quantity.trim() === '' ? Number.NaN : Number(quantity));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">Caixa</h2>

        <div className="mt-4 space-y-1 text-sm text-gray-600">
          <p>
            <strong>Lote:</strong> {lot.batchNumber ?? 'Sem lote'}
          </p>

          {lot.expirationDate && (
            <p>
              <strong>Validade:</strong> {formatDateOnly(lot.expirationDate)}
            </p>
          )}

          <p>
            <strong>Restante:</strong> {lot.remainingQuantity}
          </p>

          <p>
            <strong>Em caixas:</strong> {lot.allocatedQuantity}
          </p>

          <p>
            <strong>Disponível para caixas:</strong> {availableForBoxes}
          </p>
        </div>

        {noRoom && (
          <div role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Todo o saldo deste lote já está em caixas.
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <label htmlFor="box-search" className="mb-1 block font-medium">
          Buscar caixa por código
        </label>

        <input
          id="box-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={loading}
          placeholder="Ex.: B000001"
          className="w-full rounded-lg border p-3"
        />

        {boxesLoading && <div className="mt-4 rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Buscando caixas...</div>}

        {!boxesLoading && boxesError && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {boxesError}
          </div>
        )}

        {!boxesLoading && !boxesError && boxes.length === 0 && <p className="mt-4 text-sm text-gray-500">Nenhuma caixa encontrada. Crie uma nova caixa abaixo.</p>}

        {!boxesLoading && boxes.length > 0 && (
          <div className="mt-4 space-y-2">
            {boxes.map((box) => {
              const selected = selectedBox?.id === box.id;

              return (
                <button
                  key={box.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={loading}
                  onClick={() => onSelectBox(box)}
                  className={`w-full rounded-lg border p-3 text-left disabled:opacity-50 font-semibold transition ${selected ? 'border-black bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  {box.code}
                </button>
              );
            })}
          </div>
        )}

        <button type="button" onClick={() => void onCreateBox()} disabled={loading} className="mt-4 rounded-lg border px-5 py-3 disabled:opacity-50">
          Criar nova caixa
        </button>
      </div>

      <form noValidate onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow">
        {selectedBox ? (
          <p className="text-sm text-gray-600">
            Caixa selecionada: <strong>{selectedBox.code}</strong>
          </p>
        ) : (
          <p className="text-sm text-gray-500">Selecione ou crie uma caixa.</p>
        )}

        <label htmlFor="box-quantity" className="mb-1 mt-4 block font-medium">
          Quantidade de unidades
        </label>

        <input
          id="box-quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={availableForBoxes}
          step={1}
          value={noRoom ? '' : quantity}
          disabled={noRoom}
          onChange={(event) => setQuantity(event.target.value)}
          className="w-full rounded-lg border p-3 disabled:bg-gray-100"
        />

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onBack} className="rounded-lg border px-6 py-3">
            Voltar
          </button>

          <button type="submit" disabled={!selectedBox || noRoom || loading} className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50">
            {loading ? 'Salvando...' : 'Adicionar à caixa'}
          </button>
        </div>
      </form>
    </div>
  );
}
