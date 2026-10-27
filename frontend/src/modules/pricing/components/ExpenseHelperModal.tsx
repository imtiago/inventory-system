import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calculator } from 'lucide-react';

import { Modal } from '@/shared/components/Modal/Modal';
import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { FieldError, MoneyInput, PercentInput, fieldA11y } from '@/shared/components/form';
import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { applySubmitError } from '@/shared/utils/applyFieldErrors';
import { formatPercentInput, formatBps, percentTextError, percentTextToBps } from '@/shared/utils/percent';
import { parseMoneyToCents } from '@/shared/utils/money';

import { expenseBpsFromMonthly } from '../utils/expenseMath';
import type { PricingExpense, SaveExpenseInput } from '../types';

interface Props {
  open: boolean;
  /** Despesa em edição; sem ela, cria uma nova. */
  expense: PricingExpense | null;
  onClose: () => void;
  onSave: (input: SaveExpenseInput) => Promise<void>;
}

interface Values {
  name: string;
  percent: string;
  active: boolean;
}

export function ExpenseHelperModal({ open, expense, onClose, onSave }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={expense ? 'Editar despesa' : 'Nova despesa'} description="Despesa da venda, em percentual do preço.">
      <ExpenseForm key={expense?.id ?? 'new'} expense={expense} onCancel={onClose} onSave={onSave} />
    </Modal>
  );
}

function ExpenseForm({ expense, onSave, onCancel }: Omit<Props, 'open' | 'onClose'> & { onCancel: () => void }) {
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: { name: expense?.name ?? '', percent: expense ? formatPercentInput(expense.percent) : '', active: expense?.active ?? true } });
  const [helper, setHelper] = useState(false);
  const [monthly, setMonthly] = useState('');
  const [revenue, setRevenue] = useState('');

  const once = useSingleSubmit();
  useModalBusy(isSubmitting);

  const calculated = expenseBpsFromMonthly(parseMoneyToCents(monthly), parseMoneyToCents(revenue));
  const tooHigh = calculated !== null && calculated >= 10000;

  const submit = handleSubmit(
    once(async ({ name, percent, active }) => {
      try {
        await onSave({ name: name.trim(), percent: (percentTextToBps(percent) ?? 0) / 100, active });
      } catch (error) {
        if (applySubmitError(setError, error, ['name', 'percent'])) return;

        setError('root.server', { type: 'server', message: parseApiErrorSync(error).message });
      }
    }),
  );

  function useCalculated() {
    if (calculated === null || tooHigh) return;
    setValue('percent', formatPercentInput(calculated / 100), { shouldDirty: true, shouldValidate: true });
    clearErrors('root.server');
    setHelper(false);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="expense-name" className="mb-1 block font-medium">
          Nome
        </label>
        <input
          id="expense-name"
          type="text"
          maxLength={80}
          autoComplete="off"
          className="w-full min-h-11 rounded-lg border border-input bg-surface p-3 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:text-sm"
          {...fieldA11y('expense-name', errors.name?.message)}
          {...register('name', { validate: (v) => v.trim().length > 0 || 'Informe o nome.' })}
        />
        <FieldError id="expense-name" message={errors.name?.message} />
      </div>

      <div>
        <label htmlFor="expense-percent" className="mb-1 block font-medium">
          Percentual (%)
        </label>
        <PercentInput id="expense-percent" {...fieldA11y('expense-percent', errors.percent?.message)} {...register('percent', { validate: (v) => percentTextError(v) ?? true })} />
        <FieldError id="expense-percent" message={errors.percent?.message} />
      </div>

      <div>
        <button type="button" onClick={() => setHelper((v) => !v)} aria-expanded={helper} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary hover:bg-surface-muted">
          <Calculator size={16} aria-hidden="true" />
          Calcular pelo valor mensal
        </button>

        {helper && (
          <div className="mt-2 space-y-3 rounded-lg border border-border bg-surface-muted p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="expense-monthly" className="mb-1 block text-sm font-medium">
                  Valor mensal (R$)
                </label>
                <MoneyInput id="expense-monthly" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
              </div>
              <div>
                <label htmlFor="expense-revenue" className="mb-1 block text-sm font-medium">
                  Faturamento mensal (R$)
                </label>
                <MoneyInput id="expense-revenue" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
              <p className="text-sm text-muted">
                Resultado:{' '}
                {calculated === null ? <span>informe os dois valores</span> : tooHigh ? <span className="text-danger">deve ser menor que 100% do faturamento</span> : <strong className="text-foreground">{formatBps(calculated)}</strong>}
              </p>
              <button type="button" onClick={useCalculated} disabled={calculated === null || tooHigh} className="min-h-11 rounded-lg border border-input px-4 text-sm font-medium hover:bg-surface disabled:opacity-50">
                Usar este percentual
              </button>
            </div>
          </div>
        )}
      </div>

      {expense && (
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" {...register('active')} />
          Despesa ativa (entra no cálculo do preço)
        </label>
      )}

      {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}

      <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border px-5 py-3 hover:bg-surface-muted">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
          Salvar
        </button>
      </div>
    </form>
  );
}
