import { MoneyInput } from '@/shared/components/form';
import { parseMoneyText } from '@/shared/utils/money';
import { useForm } from 'react-hook-form';

import { useCreateVariant } from '@/modules/products/hooks/useCreateVariant';
import { useSingleSubmit } from '@/shared/hooks/useSingleSubmit';
import type { ProductVariant } from '../types';

interface ProductVariantRegistrationProps {
  /** Scanned barcode not found in the catalog; null when registering without barcode. */
  barcode: string | null;
  productId: string;
  productName: string;
  onSuccess: (variant: ProductVariant) => void;
  onCancel: () => void;
}

interface FormValues {
  name: string;
  salePrice: number | undefined;
}

function validateSalePrice(value: number | undefined) {
  if (value === undefined) return 'Informe o preço de venda.';
  if (Number.isNaN(value)) return 'Informe um preço válido.';
  if (value < 0) return 'O preço não pode ser negativo.';
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return 'O preço deve ter no máximo 2 casas decimais.';

  return true;
}

export function ProductVariantRegistration({ barcode, productId, productName, onSuccess, onCancel }: ProductVariantRegistrationProps) {
  const createVariant = useCreateVariant(productId);
  const once = useSingleSubmit();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { name: '' } });

  const loading = isSubmitting;

  const submit = handleSubmit(
    once(async ({ name, salePrice }) => {
      try {
        // The shared hook shows the success/error toast and refreshes the product's variants.
        const variant = await createVariant.mutateAsync({ name: name.trim(), ...(barcode ? { barcode } : {}), salePrice });

        onSuccess(variant as ProductVariant);
      } catch {
        // Error already notified; keep the form open.
      }
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cadastrar variante</h1>

        <p className="mt-1 text-gray-500">{barcode ? 'O código de barras ainda não está cadastrado.' : 'Cadastre uma nova variante para o produto.'}</p>
      </div>

      <div className="space-y-5 rounded-xl bg-white p-6 shadow">
        {/* Produto */}

        <div>
          <label className="mb-1 block text-sm text-gray-500">Produto</label>

          <input value={productName} readOnly className="w-full rounded-lg border bg-gray-100 p-3" />
        </div>

        {barcode && (
          <div>
            <label className="mb-1 block text-sm text-gray-500">Código de barras</label>

            <input value={barcode} readOnly className="w-full rounded-lg border bg-gray-100 p-3 font-mono" />
          </div>
        )}

        {/* Nome da variante */}

        <div>
          <label htmlFor="variant-name" className="mb-1 block">
            Nome da variante
          </label>

          <input
            id="variant-name"
            type="text"
            aria-invalid={errors.name ? 'true' : undefined}
            {...register('name', { validate: (value) => value.trim().length > 0 || 'Informe o nome da variante.' })}
            placeholder="Ex.: Kaiak 100ml"
            disabled={loading}
            className="w-full rounded-lg border p-3 disabled:opacity-50"
          />

          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}

          <p className="mt-2 text-sm text-gray-500">Informe a descrição da apresentação do produto.</p>
        </div>

        {/* Preço de venda */}

        <div>
          <label htmlFor="variant-sale-price" className="mb-1 block">
            Preço de venda (R$)
          </label>

          <MoneyInput
            id="variant-sale-price"
            disabled={loading}
            aria-invalid={errors.salePrice ? 'true' : undefined}
            {...register('salePrice', {
              setValueAs: (value) => (value === '' || value == null ? undefined : parseMoneyText(String(value))),
              validate: validateSalePrice,
            })}
          />

          {errors.salePrice && <p className="mt-1 text-sm text-red-600">{errors.salePrice.message}</p>}
        </div>
      </div>

      {/* Ações */}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg border px-6 py-3 disabled:opacity-50">
          Voltar
        </button>

        <button type="submit" disabled={loading} className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50">
          {loading ? 'Cadastrando...' : 'Cadastrar variante'}
        </button>
      </div>
    </form>
  );
}
