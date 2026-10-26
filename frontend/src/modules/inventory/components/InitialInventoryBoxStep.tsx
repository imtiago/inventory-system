import { QuantityInput } from '@/shared/components/form';
import { useState } from 'react';

import { BarcodeScanner } from '@/components/BarcodeScanner';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useInventoryBoxContents, useInventoryBoxes } from '../hooks/useInventoryBox';
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

export function InitialInventoryBoxStep({ lot, availableForBoxes, selectedBox, loading, error, onSelectBox, onCreateBox, onAddToBox, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const { boxes, isLoading: boxesLoading, error: boxesError } = useInventoryBoxes(debouncedSearch);

  // Kept as text so the field can be cleared while typing; validated on submit.
  const [quantity, setQuantity] = useState('1');

  const { box: contents } = useInventoryBoxContents(selectedBox?.code);
  const inBox = contents ? (contents.stocks.find((stock) => stock.inventoryLot.id === lot.id)?.quantity ?? 0) : null;

  const noRoom = availableForBoxes === 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    void onAddToBox(quantity.trim() === '' ? Number.NaN : Number(quantity));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface p-6 shadow">
        <h2 className="text-xl font-semibold">Caixa</h2>

        <div className="mt-4 space-y-1 text-sm text-muted">
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
          <div role="status" className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
            Todo o saldo deste lote já está em caixas.
          </div>
        )}
      </div>

      <div className="rounded-xl bg-surface p-6 shadow">
        <label htmlFor="box-search" className="mb-1 block font-medium">
          Buscar caixa por código
        </label>

        <div className="flex flex-wrap gap-3">
          <input
            id="box-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={loading}
            placeholder="Ex.: B000001"
            className="min-w-0 flex-1 rounded-lg border border-input bg-surface text-foreground p-3"
          />

          <button type="button" onClick={() => setScanning((open) => !open)} disabled={loading} className="min-h-11 rounded-lg border border-input bg-surface text-foreground px-4 disabled:opacity-50">
            Escanear caixa
          </button>
        </div>

        {scanning && (
          <div className="mt-4 rounded-lg border p-4">
            <BarcodeScanner
              onDetected={(code) => {
                setSearch(code.trim());
                setScanning(false);
              }}
            />

            <button type="button" onClick={() => setScanning(false)} className="mt-3 text-danger">
              Cancelar leitura
            </button>
          </div>
        )}

        {boxesLoading && <div className="mt-4 rounded-lg bg-surface-muted p-4 text-center text-sm text-muted">Buscando caixas...</div>}

        {!boxesLoading && boxesError && (
          <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
            {boxesError}
          </div>
        )}

        {!boxesLoading && !boxesError && boxes.length === 0 && <p className="mt-4 text-sm text-muted">Nenhuma caixa encontrada. Crie uma nova caixa abaixo.</p>}

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
                  className={`w-full rounded-lg border border-input bg-surface text-foreground p-3 text-left disabled:opacity-50 font-semibold transition ${selected ? 'border-primary bg-surface-muted' : 'border-border hover:bg-surface-muted'}`}
                >
                  {box.code}
                </button>
              );
            })}
          </div>
        )}

        <button type="button" onClick={() => void onCreateBox()} disabled={loading} className="mt-4 rounded-lg border border-input bg-surface text-foreground px-5 py-3 disabled:opacity-50">
          Criar nova caixa
        </button>
      </div>

      <form noValidate onSubmit={handleSubmit} className="rounded-xl bg-surface p-6 shadow">
        {selectedBox ? (
          <p className="text-sm text-muted">
            Caixa selecionada: <strong>{selectedBox.code}</strong>
          </p>
        ) : (
          <p className="text-sm text-muted">Selecione ou crie uma caixa.</p>
        )}

        {selectedBox && inBox !== null && (
          <p className="mt-1 text-sm text-muted">
            <span>Na caixa: {inBox}</span>
            <span className="text-muted"> (o lote tem {lot.allocatedQuantity} em caixas no total)</span>
          </p>
        )}

        <label htmlFor="box-quantity" className="mb-1 mt-4 block font-medium">
          Quantidade de unidades
        </label>

        <QuantityInput id="box-quantity" min={1} max={availableForBoxes} value={noRoom ? '' : String(quantity)} disabled={noRoom} onChange={(value) => setQuantity(value)} />

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onBack} disabled={loading} className="rounded-lg border border-input bg-surface text-foreground px-6 py-3 disabled:opacity-50">
            Voltar
          </button>

          <button type="submit" disabled={!selectedBox || noRoom || loading} className="rounded-lg bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">
            {loading ? 'Salvando...' : 'Adicionar à caixa'}
          </button>
        </div>
      </form>
    </div>
  );
}
