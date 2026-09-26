import { useState } from 'react';

import type { InventoryBox } from '../hooks/useInventoryBoxByLot';
import type { InventoryLot } from '../types/InitialInventoryTypes';

interface Props {
  lot: InventoryLot;

  boxes: InventoryBox[];

  boxesLoading: boolean;
  boxesError: string | null;

  selectedBox: InventoryBox | null;

  onSelectBox(box: InventoryBox): void;

  onCreateBox(code: string): Promise<boolean>;

  onContinue(): void | Promise<void>;
}

export function InitialInventoryBoxStep({ lot, boxes, boxesLoading, boxesError, selectedBox, onSelectBox, onCreateBox, onContinue }: Props) {
  const [boxCode, setBoxCode] = useState('');

  const [creatingBox, setCreatingBox] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateBox() {
    const code = boxCode.trim();

    if (!code) {
      setCreateError('Informe o código da caixa.');

      return;
    }

    setCreatingBox(true);
    setCreateError(null);

    try {
      const created = await onCreateBox(code);

      if (!created) {
        setCreateError('Não foi possível criar a caixa.');

        return;
      }

      setBoxCode('');
    } catch {
      setCreateError('Não foi possível criar a caixa.');
    } finally {
      setCreatingBox(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* LOTE */}
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

      {/* CAIXAS EXISTENTES */}
      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="text-lg font-semibold">Caixas disponíveis</h3>

        <p className="mt-1 text-sm text-gray-500">Selecione a caixa onde esta unidade será armazenada.</p>

        {boxesLoading && <div className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">Buscando caixas...</div>}

        {!boxesLoading && boxesError && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{boxesError}</div>}

        {!boxesLoading && !boxesError && boxes.length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">Nenhuma caixa encontrada.</p>

            <p className="mt-1 text-sm text-gray-500">Crie uma nova caixa abaixo.</p>
          </div>
        )}

        {!boxesLoading && !boxesError && boxes.length > 0 && (
          <div className="mt-6 space-y-3">
            {boxes.map((box) => {
              const selected = selectedBox?.id === box.id;

              return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => onSelectBox(box)}
                  className={`w-full rounded-lg border p-4 text-left transition ${selected ? 'border-black bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <input type="radio" checked={selected} readOnly />

                    <div>
                      <p className="font-semibold">{box.code}</p>

                      <p className="text-sm text-gray-500">Caixa existente</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* CRIAR NOVA CAIXA */}
        <div className="mt-8 border-t pt-6">
          <h3 className="font-semibold">Criar nova caixa</h3>

          <p className="mt-1 text-sm text-gray-500">Caso o produto ainda não esteja em nenhuma das caixas acima.</p>

          <div className="mt-4">
            <label htmlFor="box-code" className="mb-1 block text-sm font-medium">
              Código da caixa
            </label>

            <input
              id="box-code"
              type="text"
              value={boxCode}
              disabled={creatingBox}
              onChange={(event) => setBoxCode(event.target.value)}
              placeholder="Ex: B000020"
              className="w-full rounded-lg border p-3 disabled:bg-gray-100"
            />
          </div>

          {createError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{createError}</div>}

          <button type="button" onClick={handleCreateBox} disabled={creatingBox || !boxCode.trim()} className="mt-4 rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50">
            {creatingBox ? 'Criando...' : 'Criar caixa'}
          </button>
        </div>

        {/* CAIXA SELECIONADA */}
        {selectedBox && (
          <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">Caixa selecionada</p>

            <p className="mt-1 text-lg font-semibold text-green-900">{selectedBox.code}</p>

            <button type="button" onClick={onContinue} className="mt-4 rounded-lg bg-black px-6 py-3 text-white">
              Adicionar unidade e continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}