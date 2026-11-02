import type { FinanceKind } from '../config';
import { useForm, useWatch } from 'react-hook-form';

import { Modal } from '@/shared/components/Modal/Modal';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { MoneyInput, FieldError, fieldA11y } from '@/shared/components/form';
import { formatCents, formatCurrency, formatMoneyInput, moneyTextError, parseMoneyToCents, toCents } from '@/shared/utils/money';

import { useCan } from '@/shared/auth/useCan';
import { LoadingState } from '@/shared/components/LoadingState';

import { useRegisterPayment } from '../hooks/useRegisterPayment';
import { useLateFeeQuote } from '../hooks/useLateFeeQuote';
import { LateFeeSummary } from './LateFeeSummary';
import { PAYMENT_METHOD_LABELS, type IFinanceParcel, type PaymentMethod } from '../types';

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
const KNOWN_FIELDS = ['amount', 'method', 'paymentDate', 'reference', 'waiveAmount', 'waiverReason', 'backdateReason'] as const;

interface FormValues {
  amount: string;
  method: PaymentMethod;
  paymentDate: string;
  reference: string;
  waiveAmount: string;
  waiverReason: string;
  backdateReason: string;
}

interface Props {
  kind: FinanceKind;
  documentId: string;
  parcel: IFinanceParcel;
  onClose: () => void;
}

const inputClass = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20';

export function RegisterPaymentModal({ kind, documentId, parcel, onClose }: Props) {
  const mutation = useRegisterPayment(kind, documentId);
  const today = todayInBusinessTz();
  const remainingCents = toCents(parcel.remainingAmount);
  const isReceivable = kind === 'receivable';
  const canWaive = useCan('credit.approve');
  // A receber: data passada muda multa/juros e o histórico de crédito → só quem aprova crédito, com motivo.
  const dateLocked = isReceivable && !canWaive;

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { amount: formatMoneyInput(parcel.remainingAmount), method: 'CASH', paymentDate: today, reference: '', waiveAmount: '', waiverReason: '', backdateReason: '' },
  });

  const [paymentDate, amountText, waiveText] = useWatch({ control, name: ['paymentDate', 'amount', 'waiveAmount'] });
  const quote = useLateFeeQuote(documentId, parcel.id, paymentDate, isReceivable && paymentDate <= today);
  const feesCents = quote.data ? toCents(quote.data.fine) + toCents(quote.data.interest) : 0;
  const showWaiver = isReceivable && canWaive && feesCents > 0;
  const amountCents = parseMoneyToCents(amountText) ?? 0;
  const waivedCents = showWaiver ? (parseMoneyToCents(waiveText) ?? 0) : 0;
  const backdated = isReceivable && !dateLocked && !!paymentDate && paymentDate < today;

  function close() {
    if (mutation.isPending) return;
    onClose();
  }

  const waiveCentsOf = (values: FormValues) => (showWaiver ? (parseMoneyToCents(values.waiveAmount) ?? 0) : 0);

  async function onSubmit(values: FormValues) {
    clearErrors('root.server');

    try {
      await mutation.mutateAsync({
        parcelId: parcel.id,
        input: {
          amount: (parseMoneyToCents(values.amount) ?? 0) / 100,
          method: values.method,
          paymentDate: values.paymentDate,
          ...(values.reference.trim() ? { reference: values.reference.trim() } : {}),
          ...(waiveCentsOf(values) > 0 ? { waiveAmount: waiveCentsOf(values) / 100, waiverReason: values.waiverReason.trim() } : {}),
          ...(backdated ? { backdateReason: values.backdateReason.trim() } : {}),
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
    <Modal open onClose={close} busy={mutation.isPending} title={`Registrar pagamento — parcela ${parcel.number}`} description={`Saldo da parcela: ${formatCurrency(parcel.remainingAmount)}`} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="payment-amount" className="mb-2 block text-sm font-medium text-foreground">
            Valor
          </label>
          <MoneyInput
            id="payment-amount" {...fieldA11y("payment-amount", errors.amount?.message)}
            {...register('amount', {
              validate: (value) => {
                const problem = moneyTextError(value);
                if (problem) return problem;
                const cents = parseMoneyToCents(value) ?? 0;
                if (cents <= 0) return 'O valor deve ser maior que zero.';
                if (cents > remainingCents) return 'O valor não pode ser maior que o saldo da parcela.';
                return true;
              },
            })}
          />
          <FieldError id="payment-amount" message={errors.amount?.message} />
        </div>

        {isReceivable && quote.isLoading && <LoadingState compact label="Calculando multa e juros..." />}
        {isReceivable && quote.isError && (
          <p role="alert" className="text-sm text-danger">
            Não foi possível calcular multa e juros. O valor final é calculado ao confirmar.
          </p>
        )}
        {isReceivable && quote.data && <LateFeeSummary quote={quote.data} amountCents={amountCents} waivedCents={waivedCents} />}

        {showWaiver && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="payment-waive" className="mb-2 block text-sm font-medium text-foreground">
                Dispensar
              </label>
              <MoneyInput
                id="payment-waive"
                placeholder="0,00"
                {...fieldA11y('payment-waive', errors.waiveAmount?.message)}
                {...register('waiveAmount', {
                  validate: (value) => {
                    if (!value.trim()) return true;
                    const problem = moneyTextError(value);
                    if (problem) return problem;
                    if ((parseMoneyToCents(value) ?? 0) > feesCents) return `A dispensa não pode passar de multa + juros (${formatCents(feesCents)}).`;
                    return true;
                  },
                })}
              />
              <FieldError id="payment-waive" message={errors.waiveAmount?.message} />
            </div>
            <div>
              <label htmlFor="payment-waiver-reason" className="mb-2 block text-sm font-medium text-foreground">
                Motivo da dispensa
              </label>
              <input
                id="payment-waiver-reason"
                type="text"
                maxLength={200}
                className={inputClass}
                {...fieldA11y('payment-waiver-reason', errors.waiverReason?.message)}
                {...register('waiverReason', {
                  validate: (value, values) => {
                    if ((parseMoneyToCents(values.waiveAmount) ?? 0) <= 0) return true;
                    const reason = value.trim();
                    return (reason.length >= 3 && reason.length <= 200) || 'Informe o motivo da dispensa (3 a 200 caracteres).';
                  },
                })}
              />
              <FieldError id="payment-waiver-reason" message={errors.waiverReason?.message} />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="payment-method" className="mb-2 block text-sm font-medium text-foreground">
            Forma de pagamento
          </label>
          <select id="payment-method" {...fieldA11y("payment-method", errors.method?.message)} className={inputClass} {...register('method', { required: 'Selecione a forma de pagamento.' })}>
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </select>
          <FieldError id="payment-method" message={errors.method?.message} />
        </div>

        <div>
          <label htmlFor="payment-date" className="mb-2 block text-sm font-medium text-foreground">
            Data do pagamento
          </label>
          <input
            id="payment-date" {...fieldA11y("payment-date", errors.paymentDate?.message)}
            {...(dateLocked ? { 'aria-describedby': 'payment-date-hint' } : {})}
            type="date"
            max={today}
            readOnly={dateLocked}
            className={`${inputClass}${dateLocked ? ' bg-surface-muted text-muted' : ''}`}
            {...register('paymentDate', {
              validate: (value) => {
                if (!value) return 'Informe a data do pagamento.';
                if (value > todayInBusinessTz()) return 'A data do pagamento não pode ser futura.';
                return true;
              },
            })}
          />
          <FieldError id="payment-date" message={errors.paymentDate?.message} />
          {dateLocked && (
            <p id="payment-date-hint" className="mt-1 text-xs text-muted">
              Só quem aprova crédito lança pagamento com data passada.
            </p>
          )}
        </div>

        {backdated && (
          <div>
            <label htmlFor="payment-backdate-reason" className="mb-2 block text-sm font-medium text-foreground">
              Motivo da data passada
            </label>
            <input
              id="payment-backdate-reason"
              type="text"
              maxLength={200}
              className={inputClass}
              {...fieldA11y('payment-backdate-reason', errors.backdateReason?.message)}
              {...register('backdateReason', {
                validate: (value) => {
                  const reason = value.trim();
                  return (reason.length >= 3 && reason.length <= 200) || 'Informe o motivo da data passada (3 a 200 caracteres).';
                },
              })}
            />
            <FieldError id="payment-backdate-reason" message={errors.backdateReason?.message} />
          </div>
        )}

        <div>
          <label htmlFor="payment-reference" className="mb-2 block text-sm font-medium text-foreground">
            Referência
          </label>
          <input id="payment-reference" {...fieldA11y("payment-reference", errors.reference?.message)} type="text" className={inputClass} {...register('reference', { maxLength: { value: 100, message: 'Máximo de 100 caracteres.' } })} />
          <FieldError id="payment-reference" message={errors.reference?.message} />
        </div>

        {serverError && (
          <div role="alert" className="rounded-lg border border-danger/30 p-3 text-sm text-danger">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg border px-4 py-2 hover:bg-surface-muted disabled:opacity-50" onClick={close} disabled={mutation.isPending}>
            Voltar
          </button>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover disabled:opacity-50" disabled={mutation.isPending}>
            {mutation.isPending ? 'Registrando...' : 'Confirmar pagamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
