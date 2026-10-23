import type { FinanceKind } from '../config';
import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { formatCurrency } from '@/shared/utils/money';

import { useReversePayment } from '../hooks/useReversePayment';
import type { IFinancePayment } from '../types';

interface Props {
  kind: FinanceKind;
  documentId: string;
  payment: IFinancePayment;
  onClose: () => void;
}

const REASON_MESSAGE = 'Informe o motivo (3 a 200 caracteres).';

export function ReversePaymentModal({ kind, documentId, payment, onClose }: Props) {
  const mutation = useReversePayment(kind, documentId);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<{ reason: string }>({ defaultValues: { reason: '' } });

  function close() {
    if (mutation.isPending) return;
    onClose();
  }

  async function onSubmit({ reason }: { reason: string }) {
    clearErrors('root.server');

    try {
      await mutation.mutateAsync({ paymentId: payment.id, reason: reason.trim() });
      onClose();
    } catch (error) {
      if (!applySubmitError(setError, error, ['reason'])) {
        setError('root.server', { type: 'server', message: parseApiErrorSync(error).message || 'Não foi possível estornar o pagamento.' });
      }
    }
  }

  const serverError = errors.root?.server?.message;

  return (
    <Modal open onClose={close} title="Estornar pagamento" description={`Pagamento de ${formatCurrency(payment.amount)}. O saldo da parcela será restaurado.`} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="reverse-reason" className="mb-2 block text-sm font-medium text-gray-700">
            Motivo
          </label>
          <textarea
            id="reverse-reason"
            rows={3}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            {...register('reason', {
              validate: (value) => {
                const length = value.trim().length;
                return length >= 3 && length <= 200 ? true : REASON_MESSAGE;
              },
            })}
          />
          {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>}
        </div>

        {serverError && (
          <div role="alert" className="rounded-lg border border-red-200 p-3 text-sm text-red-600">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 hover:bg-gray-100 disabled:opacity-50" onClick={close} disabled={mutation.isPending}>
            Voltar
          </button>
          <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50" disabled={mutation.isPending}>
            {mutation.isPending ? 'Estornando...' : 'Confirmar estorno'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
