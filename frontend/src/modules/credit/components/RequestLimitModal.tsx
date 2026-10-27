import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { FieldError, MoneyInput, fieldA11y } from '@/shared/components/form';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';
import { notify } from '@/shared/utils/notify';

import { useCreateLimitRequest } from '../hooks/useCredit';
import { inputClass } from './CreditField';

interface FormValues {
  limit: string;
  reason: string;
}

const REASON_MESSAGE = 'Informe o motivo (3 a 300 caracteres)';

function RequestForm({ customerId, currentLimit, onClose }: { customerId: string; currentLimit: number; onClose: () => void }) {
  const create = useCreateLimitRequest();
  useModalBusy(create.isPending);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { limit: '', reason: '' } });

  const submit = handleSubmit(async (values) => {
    clearErrors('root.server');

    try {
      const request = await create.mutateAsync({ customerId, requestedLimit: (parseMoneyToCents(values.limit) ?? 0) / 100, reason: values.reason.trim() });
      notify.success(
        request.autoApproved
          ? `Limite aprovado automaticamente: ${formatCurrency(request.approvedLimit ?? request.requestedLimit)}.`
          : 'Pedido enviado para aprovação.',
      );
      onClose();
    } catch (error) {
      setError('root.server', { type: 'server', message: parseApiErrorSync(error).message || 'Não foi possível enviar o pedido.' });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <p className="text-sm text-muted">Limite atual: {formatCurrency(currentLimit)}</p>

      <div>
        <label htmlFor="limit-request-limit" className="mb-1 block font-medium">
          Novo limite (R$)
        </label>
        <MoneyInput
          id="limit-request-limit"
          {...fieldA11y('limit-request-limit', errors.limit?.message)}
          {...register('limit', {
            validate: (v) => {
              const error = moneyTextError(v);
              if (error) return error;
              return (parseMoneyToCents(v) ?? 0) > Math.round(currentLimit * 100) ? true : `O novo limite deve ser maior que o limite atual (${formatCurrency(currentLimit)})`;
            },
          })}
        />
        <FieldError id="limit-request-limit" message={errors.limit?.message} />
      </div>

      <div>
        <label htmlFor="limit-request-reason" className="mb-1 block font-medium">
          Motivo
        </label>
        <textarea
          id="limit-request-reason"
          rows={3}
          maxLength={300}
          className={inputClass}
          {...fieldA11y('limit-request-reason', errors.reason?.message)}
          {...register('reason', { validate: (v) => (v.trim().length >= 3 ? true : REASON_MESSAGE) })}
        />
        <FieldError id="limit-request-reason" message={errors.reason?.message} />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={create.isPending} className="min-h-11 rounded-lg border border-input bg-surface px-5 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
          Cancelar
        </button>
        <button type="submit" disabled={create.isPending} className="min-h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          {create.isPending ? 'Enviando...' : 'Enviar pedido'}
        </button>
      </div>
    </form>
  );
}

/** Vendedor pede aumento do limite do cliente; clientes em dia sobem na hora, os demais vão para aprovação. */
export function RequestLimitModal({ customerId, currentLimit, open, onClose }: { customerId: string; currentLimit: number; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Pedir aumento de limite" description="Clientes com bom histórico sobem na hora; os demais ficam esperando a aprovação.">
      {open && <RequestForm customerId={customerId} currentLimit={currentLimit} onClose={onClose} />}
    </Modal>
  );
}
