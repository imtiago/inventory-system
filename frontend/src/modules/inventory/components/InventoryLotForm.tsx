import { applyFieldErrors } from '@/shared/utils/applyFieldErrors';
import { Controller, useForm } from 'react-hook-form';

import { MoneyInput, QuantityInput } from '@/shared/components/form';
import { formatMoneyInput, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';

/** O custo fica no formulário como o texto digitado (pt-BR); vira número só no envio. */
interface FormValues extends Omit<InventoryLotFormData, 'unitCost'> {
  unitCost: string;
}

export interface InventoryLotFormData {
  batchNumber: string;
  manufacturingDate?: string;
  expirationDate: string;
  quantity: number;
  unitCost: number;
}

interface Props {
  initialValues?: Partial<InventoryLotFormData>;
  submitting?: boolean;
  submitError?: string | null;

  /** May resolve with backend field errors (dotted paths) to show on the form. */
  onSubmit(data: InventoryLotFormData): void | { fieldErrors?: Record<string, string> } | Promise<void | { fieldErrors?: Record<string, string> }>;

  onCancel(): void;
}

const LOT_FIELDS = ['batchNumber', 'manufacturingDate', 'expirationDate', 'quantity', 'unitCost'] as const;

export function InventoryLotForm({ initialValues, submitting = false, submitError = null, onSubmit, onCancel }: Props) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      batchNumber: initialValues?.batchNumber ?? '',

      manufacturingDate: initialValues?.manufacturingDate ?? '',

      expirationDate: initialValues?.expirationDate ?? '',

      quantity: initialValues?.quantity ?? 1,

      // No silent default: an empty cost must be typed (required below).
      unitCost: initialValues?.unitCost === undefined ? '' : formatMoneyInput(initialValues.unitCost),
    },
  });

  const submit = handleSubmit(async (data) => {
    const result = await onSubmit({ ...data, unitCost: (parseMoneyToCents(data.unitCost) ?? 0) / 100 });

    if (result?.fieldErrors) {
      const { unmatched } = applyFieldErrors(setError, result.fieldErrors, LOT_FIELDS);
      const messages = Object.values(unmatched);

      if (messages.length > 0) setError('root.server', { type: 'server', message: messages.join(' ') });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-5 rounded-xl bg-surface p-6 shadow">
        {/* LOTE */}
        <div>
          <label htmlFor="batchNumber" className="mb-1 block">
            Lote
          </label>

          <input
            id="batchNumber"
            type="text"
            {...register('batchNumber', {
              required: 'Informe o lote.',
            })}
            className="w-full rounded-lg border border-input bg-surface text-foreground p-3"
            placeholder="Ex: 123456"
          />

          {errors.batchNumber && <p className="mt-1 text-sm text-danger">{errors.batchNumber.message}</p>}
        </div>

        {/* DATA DE FABRICAÇÃO */}
        <div>
          <label htmlFor="manufacturingDate" className="mb-1 block">
            Data de fabricação
          </label>

          <input id="manufacturingDate" type="date" {...register('manufacturingDate')} className="w-full rounded-lg border border-input bg-surface text-foreground p-3" />

          {errors.manufacturingDate && <p className="mt-1 text-sm text-danger">{errors.manufacturingDate.message}</p>}
        </div>

        {/* VALIDADE */}
        <div>
          <label htmlFor="expirationDate" className="mb-1 block">
            Validade
          </label>

          <input
            id="expirationDate"
            type="date"
            {...register('expirationDate', {
              required: 'Informe a validade.',
            })}
            className="w-full rounded-lg border border-input bg-surface text-foreground p-3"
          />

          {errors.expirationDate && <p className="mt-1 text-sm text-danger">{errors.expirationDate.message}</p>}
        </div>

        {/* CUSTO UNITÁRIO */}
        <div>
          <label htmlFor="unitCost" className="mb-1 block">
            Custo unitário
          </label>

          <MoneyInput
            id="unitCost"
            {...register('unitCost', {
              validate: (value) => (value.trim() === '' ? 'Informe o custo unitário.' : (moneyTextError(value) ?? true)),
            })}
          />

          {errors.unitCost && <p className="mt-1 text-sm text-danger">{errors.unitCost.message}</p>}

          <p className="mt-1 text-sm text-muted">Informe quanto cada unidade deste lote custou.</p>
        </div>

        {/* QUANTIDADE */}
        <div>
          <label htmlFor="quantity" className="mb-1 block">
            Quantidade
          </label>

          <Controller
            control={control}
            name="quantity"
            rules={{
              validate: (value) => {
                if (!Number.isFinite(value)) return 'Informe a quantidade.';
                if (value < 1) return 'A quantidade deve ser maior que zero.';
                return Number.isInteger(value) || 'A quantidade deve ser um número inteiro.';
              },
            }}
            render={({ field }) => (
              <QuantityInput id="quantity" value={Number.isFinite(field.value) ? String(field.value) : ''} onChange={(value) => field.onChange(value === '' ? Number.NaN : Number(value))} onBlur={field.onBlur} />
            )}
          />

          {errors.quantity && <p className="mt-1 text-sm text-danger">{errors.quantity.message}</p>}
        </div>
      </div>

      {/* ERRO */}
      {submitError && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-danger">
          {submitError}
        </div>
      )}

      {/* AÇÕES */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={submitting} className="rounded-lg border border-input bg-surface text-foreground px-6 py-3 disabled:opacity-50">
          Cancelar
        </button>

        <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">
          {submitting ? 'Salvando...' : 'Salvar lote'}
        </button>
      </div>
    {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}
    </form>
  );
}
