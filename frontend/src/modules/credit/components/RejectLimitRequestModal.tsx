import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { FieldError, fieldA11y } from '@/shared/components/form';
import { parseApiErrorSync } from '@/shared/services/parseApiError';

import { useRejectLimitRequest } from '../hooks/useCredit';
import type { CreditLimitRequest } from '../types';
import { inputClass } from './CreditField';

const REASON_MESSAGE = 'Informe o motivo (3 a 300 caracteres)';

function RejectForm({ request, onClose }: { request: CreditLimitRequest; onClose: () => void }) {
  const reject = useRejectLimitRequest();
  useModalBusy(reject.isPending);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<{ reason: string }>({ defaultValues: { reason: '' } });

  const submit = handleSubmit(async ({ reason }) => {
    clearErrors('root.server');

    try {
      await reject.mutateAsync({ id: request.id, reason: reason.trim() });
      onClose();
    } catch (error) {
      setError('root.server', { type: 'server', message: parseApiErrorSync(error).message || 'Não foi possível recusar o pedido.' });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <div>
        <label htmlFor="limit-reject-reason" className="mb-1 block font-medium">
          Motivo
        </label>
        <textarea
          id="limit-reject-reason"
          rows={3}
          maxLength={300}
          className={inputClass}
          {...fieldA11y('limit-reject-reason', errors.reason?.message)}
          {...register('reason', { validate: (v) => (v.trim().length >= 3 ? true : REASON_MESSAGE) })}
        />
        <FieldError id="limit-reject-reason" message={errors.reason?.message} />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={reject.isPending} className="min-h-11 rounded-lg border border-input bg-surface px-5 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
          Voltar
        </button>
        <button type="submit" disabled={reject.isPending} className="min-h-11 rounded-lg bg-danger-solid px-5 font-medium text-danger-foreground hover:bg-danger-solid/90 disabled:opacity-50">
          {reject.isPending ? 'Recusando...' : 'Confirmar recusa'}
        </button>
      </div>
    </form>
  );
}

/** Recusar um pedido de aumento: o motivo fica no histórico do pedido. */
export function RejectLimitRequestModal({ request, onClose }: { request: CreditLimitRequest | null; onClose: () => void }) {
  return (
    <Modal open={request !== null} onClose={onClose} title="Recusar pedido" description={request ? `O limite de ${request.customer.name} continua o mesmo.` : ''}>
      {request && <RejectForm request={request} onClose={onClose} />}
    </Modal>
  );
}
