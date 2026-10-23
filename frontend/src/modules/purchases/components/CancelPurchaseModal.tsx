import { useState } from 'react';

import { Modal } from '@/shared/components/Modal/Modal';
import { parseApiErrorSync } from '@/shared/services/parseApiError';

import { useCancelPurchase } from '../hooks/usePurchases';

const REFRESH_CODES = ['PURCHASE_ALREADY_CANCELED', 'PURCHASE_HAS_RECEIPTS', 'CONCURRENT_UPDATE'];

function CancelForm({ purchaseId, onClose }: { purchaseId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCancelPurchase(purchaseId);

  function handleSubmit() {
    const trimmed = reason.trim();

    if (trimmed.length < 3 || trimmed.length > 200) {
      setError('Informe o motivo do cancelamento (3 a 200 caracteres).');
      return;
    }

    setError(null);
    mutation.mutate(trimmed, {
      onSuccess: onClose,
      onError: (err) => {
        const parsed = parseApiErrorSync(err);

        // The axios interceptor already redirects to /login on 401.
        if (parsed.status === 401) return;

        setError(parsed.code === 'UNKNOWN_ERROR' ? 'Não foi possível cancelar o pedido.' : parsed.message);
        if (REFRESH_CODES.includes(parsed.code)) void mutation.refreshDetail();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="cancel-reason" className="mb-1 block text-sm font-medium">
          Motivo do cancelamento
        </label>
        <textarea
          id="cancel-reason"
          rows={3}
          maxLength={200}
          value={reason}
          disabled={mutation.isPending}
          onChange={(event) => setReason(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-lg border px-4 py-2 hover:bg-gray-100 disabled:opacity-50" onClick={onClose} disabled={mutation.isPending}>
          Voltar
        </button>
        <button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50" onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
        </button>
      </div>
    </div>
  );
}

export function CancelPurchaseModal({ purchaseId, open, onClose }: { purchaseId: string; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Cancelar pedido" description="O contas a pagar do pedido também será cancelado. Esta ação não pode ser desfeita." size="md">
      {open && <CancelForm purchaseId={purchaseId} onClose={onClose} />}
    </Modal>
  );
}
