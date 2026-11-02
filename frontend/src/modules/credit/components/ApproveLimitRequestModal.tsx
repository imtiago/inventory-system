import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { FieldError, MoneyInput, fieldA11y } from '@/shared/components/form';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatCurrency, formatMoneyInput, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';

import { useApproveLimitRequest } from '../hooks/useCredit';
import type { ApproveLimitRequestInput, CreditLimitRequest } from '../types';
import { inputClass } from './CreditField';

interface FormValues {
  limit: string;
  reason: string;
}

function ApproveForm({ request, onClose }: { request: CreditLimitRequest; onClose: () => void }) {
  const approve = useApproveLimitRequest();
  useModalBusy(approve.isPending);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { limit: formatMoneyInput(request.requestedLimit), reason: '' } });

  const submit = handleSubmit(async (values) => {
    clearErrors('root.server');

    const input: ApproveLimitRequestInput = { id: request.id };
    const cents = parseMoneyToCents(values.limit) ?? 0;
    if (cents !== Math.round(request.requestedLimit * 100)) input.approvedLimit = cents / 100;
    if (values.reason.trim()) input.reason = values.reason.trim();

    try {
      await approve.mutateAsync(input);
      onClose();
    } catch (error) {
      setError('root.server', { type: 'server', message: parseApiErrorSync(error).message || 'Não foi possível aprovar o pedido.' });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <p className="text-sm text-muted">
        Limite atual: {formatCurrency(request.currentLimit)} · Pedido: {formatCurrency(request.requestedLimit)}
      </p>

      <div>
        <label htmlFor="limit-approve-limit" className="mb-1 block font-medium">
          Limite aprovado (R$)
        </label>
        <MoneyInput
          id="limit-approve-limit"
          {...fieldA11y('limit-approve-limit', errors.limit?.message)}
          {...register('limit', { validate: (v) => moneyTextError(v) ?? ((parseMoneyToCents(v) ?? 0) > 0 ? true : 'Informe um valor maior que zero') })}
        />
        <FieldError id="limit-approve-limit" message={errors.limit?.message} />
      </div>

      <div>
        <label htmlFor="limit-approve-reason" className="mb-1 block font-medium">
          Observação (opcional)
        </label>
        <textarea id="limit-approve-reason" rows={2} maxLength={200} className={inputClass} {...register('reason')} />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={approve.isPending} className="min-h-11 rounded-lg border border-input bg-surface px-5 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
          Voltar
        </button>
        <button type="submit" disabled={approve.isPending} className="min-h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          {approve.isPending ? 'Aprovando...' : 'Aprovar pedido'}
        </button>
      </div>
    </form>
  );
}

/** Aprovar um pedido de aumento: pode ajustar o valor; o limite do cliente muda na hora. */
export function ApproveLimitRequestModal({ request, onClose }: { request: CreditLimitRequest | null; onClose: () => void }) {
  return (
    <Modal open={request !== null} onClose={onClose} title="Aprovar aumento de limite" description={request ? `${request.customer.name}: o limite muda assim que você confirmar.` : ''}>
      {request && <ApproveForm request={request} onClose={onClose} />}
    </Modal>
  );
}
