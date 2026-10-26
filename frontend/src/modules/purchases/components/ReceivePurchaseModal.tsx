import { QuantityInput } from '@/shared/components/form';
import { useState } from 'react';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { parseApiErrorSync } from '@/shared/services/parseApiError';

import { useReceivePurchase } from '../hooks/usePurchases';
import type { IPurchaseDetail, IReceivePurchaseDTO } from '../types';

interface Row {
  quantity: string;
  batchNumber: string;
  manufacturingDate: string;
  expirationDate: string;
}

const REFRESH_CODES = ['PURCHASE_CANCELED', 'PURCHASE_ALREADY_RECEIVED', 'RECEIPT_EXCEEDS_REMAINING', 'CONCURRENT_UPDATE'];
const BATCH_HINT = 'Use outro número de lote (ex.: acrescente o código do pedido).';
const inputClass = 'w-full rounded-md border px-2 py-1.5 text-sm';

function ReceiveForm({ purchase, onClose }: { purchase: IPurchaseDetail; onClose: () => void }) {
  const pendingItems = purchase.items.filter((item) => item.remainingQuantity > 0);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(pendingItems.map((item) => [item.id, { quantity: String(item.remainingQuantity), batchNumber: '', manufacturingDate: '', expirationDate: '' }])),
  );
  const [error, setError] = useState<string | null>(null);
  const mutation = useReceivePurchase(purchase.id);
  useModalBusy(mutation.isPending);

  function setField(id: string, field: keyof Row, value: string) {
    setRows((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  function handleSubmit() {
    setError(null);
    const items: IReceivePurchaseDTO['items'] = [];

    for (const item of pendingItems) {
      const row = rows[item.id];
      const quantity = row.quantity.trim() === '' ? 0 : Number(row.quantity);

      if (!Number.isInteger(quantity) || quantity < 0 || quantity > item.remainingQuantity) {
        setError(`${item.productVariant.name}: informe uma quantidade inteira entre 0 e ${item.remainingQuantity}.`);
        return;
      }

      if (quantity === 0) continue;

      if (row.manufacturingDate && row.expirationDate && row.expirationDate < row.manufacturingDate) {
        setError(`${item.productVariant.name}: a validade não pode ser anterior à fabricação.`);
        return;
      }

      const batchNumber = row.batchNumber.trim();

      items.push({
        purchaseItemId: item.id,
        quantity,
        ...(batchNumber ? { batchNumber } : {}),
        ...(row.manufacturingDate ? { manufacturingDate: row.manufacturingDate } : {}),
        ...(row.expirationDate ? { expirationDate: row.expirationDate } : {}),
      });
    }

    if (items.length === 0) {
      setError('Informe a quantidade recebida de pelo menos um item.');
      return;
    }

    mutation.mutate(
      { items },
      {
        onSuccess: onClose,
        onError: (err) => {
          const parsed = parseApiErrorSync(err);

          // The axios interceptor already redirects to /login on 401.
          if (parsed.status === 401) return;

          if (parsed.code === 'BATCH_ALREADY_EXISTS') {
            setError(`${parsed.message} ${BATCH_HINT}`);
            return;
          }

          setError(parsed.code === 'UNKNOWN_ERROR' ? 'Não foi possível registrar o recebimento.' : parsed.message);
          if (REFRESH_CODES.includes(parsed.code)) void mutation.refreshDetail();
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {pendingItems.map((item) => {
          const row = rows[item.id];
          const name = item.productVariant.name;

          return (
            <fieldset key={item.id} className="rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">
                {name} <span className="text-xs text-gray-500">({item.productVariant.code} · restante {item.remainingQuantity})</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor={`rq-${item.id}`} className="mb-1 block text-xs text-gray-500">Quantidade</label>
                  <QuantityInput
                    id={`rq-${item.id}`}
                    aria-label={`Quantidade a receber de ${name}`}
                    itemName={name}
                    min={0}
                    max={item.remainingQuantity}
                    value={row.quantity}
                    disabled={mutation.isPending}
                    onChange={(value) => setField(item.id, 'quantity', value)}
                  />
                </div>
                <div>
                  <label htmlFor={`rb-${item.id}`} className="mb-1 block text-xs text-gray-500">Lote</label>
                  <input id={`rb-${item.id}`} aria-label={`Lote de ${name}`} maxLength={60} value={row.batchNumber} disabled={mutation.isPending} onChange={(event) => setField(item.id, 'batchNumber', event.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`rm-${item.id}`} className="mb-1 block text-xs text-gray-500">Fabricação</label>
                  <input id={`rm-${item.id}`} aria-label={`Fabricação de ${name}`} type="date" value={row.manufacturingDate} disabled={mutation.isPending} onChange={(event) => setField(item.id, 'manufacturingDate', event.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`re-${item.id}`} className="mb-1 block text-xs text-gray-500">Validade</label>
                  <input id={`re-${item.id}`} aria-label={`Validade de ${name}`} type="date" value={row.expirationDate} min={row.manufacturingDate || undefined} disabled={mutation.isPending} onChange={(event) => setField(item.id, 'expirationDate', event.target.value)} className={inputClass} />
                </div>
              </div>
            </fieldset>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-lg border px-4 py-2 hover:bg-gray-100 disabled:opacity-50" onClick={onClose} disabled={mutation.isPending}>
          Voltar
        </button>
        <button type="button" className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50" onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Registrando...' : 'Confirmar recebimento'}
        </button>
      </div>
    </div>
  );
}

export function ReceivePurchaseModal({ purchase, open, onClose }: { purchase: IPurchaseDetail; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Registrar recebimento" description="Informe a quantidade recebida de cada item. Lote e validade são opcionais." size="2xl">
      {open && <ReceiveForm purchase={purchase} onClose={onClose} />}
    </Modal>
  );
}
