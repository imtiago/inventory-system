import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { FieldError, MoneyInput, fieldA11y } from '@/shared/components/form';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { formatMoneyInput, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';

import { useUpdateCustomerCredit } from '../hooks/useCredit';
import { CREDIT_PROFILE_NAMES, CREDIT_STATUS_LABELS, type CreditProfileCode, type CreditStatus, type CustomerCredit, type UpdateCustomerCreditInput } from '../types';
import { inputClass } from './CreditField';

interface FormValues {
  profileCode: CreditProfileCode;
  limit: string;
  status: CreditStatus;
  reason: string;
}

const PROFILE_CODES = Object.keys(CREDIT_PROFILE_NAMES) as CreditProfileCode[];
const STATUSES = Object.keys(CREDIT_STATUS_LABELS) as CreditStatus[];

function EditForm({ customerId, credit, onClose }: { customerId: string; credit: CustomerCredit; onClose: () => void }) {
  const update = useUpdateCustomerCredit(customerId);
  useModalBusy(update.isPending);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { profileCode: credit.profileCode, limit: formatMoneyInput(credit.limit), status: credit.status, reason: '' } });

  const submit = handleSubmit(async (values) => {
    clearErrors('root.server');

    const input: UpdateCustomerCreditInput = { reason: values.reason.trim() };
    if (values.profileCode !== credit.profileCode) input.profileCode = values.profileCode;
    const cents = parseMoneyToCents(values.limit) ?? 0;
    if (cents !== Math.round(credit.limit * 100)) input.limit = cents / 100;
    if (values.status !== credit.status) input.status = values.status;

    if (input.profileCode === undefined && input.limit === undefined && input.status === undefined) {
      setError('root.server', { type: 'validate', message: 'Altere o perfil, o limite ou a situação' });
      return;
    }

    try {
      await update.mutateAsync(input);
      onClose();
    } catch (error) {
      setError('root.server', { type: 'server', message: parseApiErrorSync(error).message });
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
        <label htmlFor="credit-edit-profile" className="mb-1 block font-medium">
          Perfil
        </label>
        <select id="credit-edit-profile" className={inputClass} {...register('profileCode')}>
          {PROFILE_CODES.map((code) => (
            <option key={code} value={code}>
              {CREDIT_PROFILE_NAMES[code]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="credit-edit-limit" className="mb-1 block font-medium">
          Limite (R$)
        </label>
        <MoneyInput id="credit-edit-limit" {...fieldA11y('credit-edit-limit', errors.limit?.message)} {...register('limit', { validate: (v) => moneyTextError(v) ?? true })} />
        <FieldError id="credit-edit-limit" message={errors.limit?.message} />
      </div>

      <div>
        <label htmlFor="credit-edit-status" className="mb-1 block font-medium">
          Situação
        </label>
        <select id="credit-edit-status" className={inputClass} {...register('status')}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {CREDIT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="credit-edit-reason" className="mb-1 block font-medium">
          Motivo
        </label>
        <textarea
          id="credit-edit-reason"
          rows={3}
          maxLength={300}
          className={inputClass}
          {...fieldA11y('credit-edit-reason', errors.reason?.message)}
          {...register('reason', { validate: (v) => (v.trim().length >= 3 ? true : 'Informe o motivo (mínimo 3 letras)') })}
        />
        <FieldError id="credit-edit-reason" message={errors.reason?.message} />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-input bg-surface px-5 font-medium text-foreground hover:bg-surface-muted">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          {isSubmitting ? 'Salvando...' : 'Salvar ajuste'}
        </button>
      </div>
    </form>
  );
}

/** Ajuste manual da ficha (perfil, limite ou situação) com motivo obrigatório. */
export function CustomerCreditEditModal({ customerId, credit, onClose }: { customerId: string; credit: CustomerCredit | null; onClose: () => void }) {
  return (
    <Modal open={credit !== null} onClose={onClose} title="Ajustar crédito" description="Fica registrado no histórico com o motivo.">
      {credit && <EditForm customerId={customerId} credit={credit} onClose={onClose} />}
    </Modal>
  );
}
