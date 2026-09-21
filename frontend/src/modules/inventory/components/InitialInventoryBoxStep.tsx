import { useState } from 'react';

import type { InventoryBox } from '../hooks/useInventoryBoxByLot';

import type { InventoryLot } from '../types/InitialInventoryTypes';

interface Props {
  lot: InventoryLot;

  existingBox: InventoryBox | null;

  boxLoading: boolean;
  boxError: string | null;

  boxCode: string;
  boxLocked: boolean;

  onCreateBox(code: string, quantity: number): Promise<boolean>;

  onContinue(quantity: number): void;
}

export function InitialInventoryBoxStep({ lot, existingBox, boxLoading, boxError, boxCode, boxLocked, onCreateBox, onContinue }: Props) {
  const [code, setCode] = useState(boxCode);

  const [quantity, setQuantity] = useState(1);

  const hasExistingBox = Boolean(existingBox);

  async function handleCreateBox() {
    if (!code.trim()) {
      return;
    }

    if (quantity < 1) {
      return;
    }

    await onCreateBox(code.trim(), quantity);
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
              <strong>Validade:</strong> {new Date(lot.expirationDate).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        {hasExistingBox && existingBox ? (
          <>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-700">Caixa encontrada para este lote.</p>

              <p className="mt-1 text-lg font-semibold text-green-900">{existingBox.code}</p>
            </div>

            <div className="mt-5">
              <label htmlFor="inventory-quantity" className="mb-1 block font-medium">
                Quantidade
              </label>

              <input id="inventory-quantity" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="w-full rounded-lg border p-3" />
            </div>

            <button type="button" onClick={() => onContinue(quantity)} disabled={quantity < 1} className="mt-5 rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50">
              Continuar
            </button>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="boxCode" className="mb-1 block font-medium">
                Código da caixa
              </label>

              <input
                id="boxCode"
                type="text"
                value={code}
                disabled={boxLocked || boxLoading}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Ex: C0015"
                className="w-full rounded-lg border p-3 disabled:bg-gray-100"
              />
            </div>

            <div className="mt-5">
              <label htmlFor="inventory-quantity" className="mb-1 block font-medium">
                Quantidade
              </label>

              <input
                id="inventory-quantity"
                type="number"
                min={1}
                step={1}
                value={quantity}
                disabled={boxLoading}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="w-full rounded-lg border p-3 disabled:bg-gray-100"
              />
            </div>

            {boxError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{boxError}</div>}

            <button type="button" onClick={handleCreateBox} disabled={boxLoading || !code.trim() || quantity < 1} className="mt-5 rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50">
              {boxLoading ? 'Salvando...' : 'Criar caixa e continuar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
