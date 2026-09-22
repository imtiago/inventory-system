import { useForm } from 'react-hook-form';

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

      unitCost: initialValues?.unitCost ?? 0,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-5 rounded-xl bg-white p-6 shadow">
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
            className="w-full rounded-lg border p-3"
            placeholder="Ex: 123456"
          />

          {errors.batchNumber && <p className="mt-1 text-sm text-red-600">{errors.batchNumber.message}</p>}
        </div>

        {/* DATA DE FABRICAÇÃO */}
        <div>
          <label htmlFor="manufacturingDate" className="mb-1 block">
            Data de fabricação
          </label>

          <input id="manufacturingDate" type="date" {...register('manufacturingDate')} className="w-full rounded-lg border p-3" />
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
            className="w-full rounded-lg border p-3"
          />

          {errors.expirationDate && <p className="mt-1 text-sm text-red-600">{errors.expirationDate.message}</p>}
        </div>

        {/* CUSTO UNITÁRIO */}
        <div>
          <label htmlFor="unitCost" className="mb-1 block">
            Custo unitário
          </label>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>

            <input
              id="unitCost"
              type="number"
              min={0}
              step="0.01"
              {...register('unitCost', {
                required: 'Informe o custo unitário.',

                valueAsNumber: true,

                min: {
                  value: 0,
                  message: 'O custo não pode ser negativo.',
                },

                validate: (value) => Number.isFinite(value) || 'Informe um custo válido.',
              })}
              className="w-full rounded-lg border p-3 pl-10"
              placeholder="0,00"
            />
          </div>

          {errors.unitCost && <p className="mt-1 text-sm text-red-600">{errors.unitCost.message}</p>}

          <p className="mt-1 text-sm text-gray-500">Informe quanto cada unidade deste lote custou.</p>
        </div>

        {/* QUANTIDADE */}
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

      {/* ERRO */}
      {submitError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{submitError}</div>}

      {/* AÇÕES */}
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
