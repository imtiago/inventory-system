import { useForm } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { formatCurrency, toCents } from '@/shared/utils/money';

import { useRegisterPayment } from '../hooks/useRegisterPayment';
import { PAYMENT_METHOD_LABELS, type IReceivableParcel, type PaymentMethod } from '../types';

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
const KNOWN_FIELDS = ['amount', 'method', 'paymentDate', 'reference'] as const;

interface FormValues {
  amount: string;
  method: PaymentMethod;
  paymentDate: string;
  reference: string;
}

export function todayLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Props {
  receivableId: string;
  parcel: IReceivableParcel;
  onClose: () => void;
}

const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function RegisterPaymentModal({ receivableId, parcel, onClose }: Props) {
  const mutation = useRegisterPayment(receivableId);
  const today = todayLocal();
  const remainingCents = toCents(parcel.remainingAmount);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { amount: parcel.remainingAmount.toFixed(2), method: 'CASH', paymentDate: today, reference: '' },
  });

  function close() {
    if (mutation.isPending) return;
    onClose();
  }

  async function onSubmit(values: FormValues) {
    clearErrors('root.server');

    try {
      await mutation.mutateAsync({
        parcelId: parcel.id,
        input: {
          amount: Number(values.amount.trim().replace(',', '.')),
          method: values.method,
          paymentDate: values.paymentDate,
          ...(values.reference.trim() ? { reference: values.reference.trim() } : {}),
        },
      });
      onClose();
    } catch (error) {
      if (!applySubmitError(setError, error, KNOWN_FIELDS)) {
        setError('root.server', { type: 'server', message: parseApiErrorSync(error).message || 'Não foi possível registrar o pagamento.' });
      }
    }
  }

  const serverError = errors.root?.server?.message;

  return (
    <Modal open onClose={close} title={`Registrar pagamento — parcela ${parcel.number}`} description={`Saldo da parcela: ${formatCurrency(parcel.remainingAmount)}`} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="payment-amount" className="mb-2 block text-sm font-medium text-gray-700">
            Valor
          </label>
          <input
            id="payment-amount"
            type="text"
            inputMode="decimal"
            className={inputClass}
            {...register('amount', {
              validate: (value) => {
                const normalized = value.trim().replace(',', '.');
                if (!/^\d+(\.\d+)?$/.test(normalized)) return 'Informe um valor válido.';
                if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 'Use no máximo 2 casas decimais.';
                const cents = toCents(Number(normalized));
                if (cents <= 0) return 'O valor deve ser maior que zero.';
                if (cents > remainingCents) return 'O valor não pode ser maior que o saldo da parcela.';
                return true;
              },
            })}
          />
          {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
        </div>

        <div>
          <label htmlFor="payment-method" className="mb-2 block text-sm font-medium text-gray-700">
            Forma de pagamento
          </label>
          <select id="payment-method" className={inputClass} {...register('method', { required: 'Selecione a forma de pagamento.' })}>
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </select>
          {errors.method && <p className="mt-1 text-sm text-red-600">{errors.method.message}</p>}
        </div>

        <div>
          <label htmlFor="payment-date" className="mb-2 block text-sm font-medium text-gray-700">
            Data do pagamento
          </label>
          <input
            id="payment-date"
            type="date"
            max={today}
            className={inputClass}
            {...register('paymentDate', {
              validate: (value) => {
                if (!value) return 'Informe a data do pagamento.';
                if (value > todayLocal()) return 'A data do pagamento não pode ser futura.';
                return true;
              },
            })}
          />
          {errors.paymentDate && <p className="mt-1 text-sm text-red-600">{errors.paymentDate.message}</p>}
        </div>

        <div>
          <label htmlFor="payment-reference" className="mb-2 block text-sm font-medium text-gray-700">
            Referência
          </label>
          <input id="payment-reference" type="text" className={inputClass} {...register('reference', { maxLength: { value: 100, message: 'Máximo de 100 caracteres.' } })} />
          {errors.reference && <p className="mt-1 text-sm text-red-600">{errors.reference.message}</p>}
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
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50" disabled={mutation.isPending}>
            {mutation.isPending ? 'Registrando...' : 'Confirmar pagamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
