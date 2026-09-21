import { useForm } from 'react-hook-form';

export interface InventoryLotFormData {
  batchNumber: string;
  manufacturingDate?: string;
  expirationDate: string;
  quantity: number;
}

interface Props {
  initialValues?: Partial<InventoryLotFormData>;
  submitting?: boolean;
  submitError?: string | null;

  onSubmit(data: InventoryLotFormData): void;

  onCancel(): void;
}

export function InventoryLotForm({ initialValues, submitting = false, submitError = null, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InventoryLotFormData>({
    defaultValues: {
      batchNumber: initialValues?.batchNumber ?? '',

      manufacturingDate: initialValues?.manufacturingDate ?? '',

      expirationDate: initialValues?.expirationDate ?? '',

      quantity: initialValues?.quantity ?? 1,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-5 rounded-xl bg-white p-6 shadow">
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
            className="w-full rounded-lg border p-3"
            placeholder="Ex: 123456"
          />

          {errors.batchNumber && <p className="mt-1 text-sm text-red-600">{errors.batchNumber.message}</p>}
        </div>

        <div>
          <label htmlFor="manufacturingDate" className="mb-1 block">
            Data de fabricação
          </label>

          <input id="manufacturingDate" type="date" {...register('manufacturingDate')} className="w-full rounded-lg border p-3" />
        </div>

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
            className="w-full rounded-lg border p-3"
          />

          {errors.expirationDate && <p className="mt-1 text-sm text-red-600">{errors.expirationDate.message}</p>}
        </div>

        <div>
          <label htmlFor="quantity" className="mb-1 block">
            Quantidade
          </label>

          <input
            id="quantity"
            type="number"
            min={1}
            step={1}
            {...register('quantity', {
              required: 'Informe a quantidade.',

              valueAsNumber: true,

              min: {
                value: 1,
                message: 'A quantidade deve ser maior que zero.',
              },

              validate: (value) => Number.isInteger(value) || 'A quantidade deve ser um número inteiro.',
            })}
            className="w-full rounded-lg border p-3"
          />

          {errors.quantity && <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>}
        </div>
      </div>

      {submitError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{submitError}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={submitting} className="rounded-lg border px-6 py-3 disabled:opacity-50">
          Cancelar
        </button>

        <button type="submit" disabled={submitting} className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50">
          {submitting ? 'Salvando...' : 'Salvar lote'}
        </button>
      </div>
    </form>
  );
}
