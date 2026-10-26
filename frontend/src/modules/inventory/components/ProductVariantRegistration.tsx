import { MoneyInput, FieldError, fieldA11y } from '@/shared/components/form';
import { moneyTextError, parseMoneyToCents } from '@/shared/utils/money';
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
  salePrice: string;
}

function validateSalePrice(text: string) {
  if (text.trim() === '') return 'Informe o preço de venda.';

  return moneyTextError(text) ?? true;
}

export function ProductVariantRegistration({ barcode, productId, productName, onSuccess, onCancel }: ProductVariantRegistrationProps) {
  const createVariant = useCreateVariant(productId);
  const once = useSingleSubmit();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { name: '', salePrice: '' } });

  const loading = isSubmitting;

  const submit = handleSubmit(
    once(async ({ name, salePrice }) => {
      try {
        // The shared hook shows the success/error toast and refreshes the product's variants.
        const variant = await createVariant.mutateAsync({ name: name.trim(), ...(barcode ? { barcode } : {}), salePrice: (parseMoneyToCents(salePrice) ?? 0) / 100 });

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

        <p className="mt-1 text-muted">{barcode ? 'O código de barras ainda não está cadastrado.' : 'Cadastre uma nova variante para o produto.'}</p>
      </div>

      <div className="space-y-5 rounded-xl bg-surface p-6 shadow">
        {/* Produto */}

        <div>
          <label htmlFor="variant-product" className="mb-1 block text-sm text-muted">Produto</label>

          <input id="variant-product" value={productName} readOnly className="w-full rounded-lg border border-input bg-surface-muted text-foreground p-3" />
        </div>

        {barcode && (
          <div>
            <label htmlFor="variant-barcode-readonly" className="mb-1 block text-sm text-muted">Código de barras</label>

            <input id="variant-barcode-readonly" value={barcode} readOnly className="w-full rounded-lg border border-input bg-surface-muted text-foreground p-3 font-mono" />
          </div>
        )}

        {/* Nome da variante */}

        <div>
          <label htmlFor="variant-name" className="mb-1 block">
            Nome da variante
          </label>

          <input
            id="variant-name" {...fieldA11y("variant-name", errors.name?.message)}
            type="text"
            {...register('name', { validate: (value) => value.trim().length > 0 || 'Informe o nome da variante.' })}
            placeholder="Ex.: Kaiak 100ml"
            disabled={loading}
            className="w-full rounded-lg border border-input bg-surface text-foreground p-3 disabled:opacity-50"
          />

          <FieldError id="variant-name" message={errors.name?.message} />

          <p className="mt-2 text-sm text-muted">Informe a descrição da apresentação do produto.</p>
        </div>

        {/* Preço de venda */}

        <div>
          <label htmlFor="variant-sale-price" className="mb-1 block">
            Preço de venda (R$)
          </label>

          <MoneyInput
            id="variant-sale-price" {...fieldA11y("variant-sale-price", errors.salePrice?.message)}
            disabled={loading}
            {...register('salePrice', {
              validate: validateSalePrice,
            })}
          />

          <FieldError id="variant-sale-price" message={errors.salePrice?.message} />
        </div>
      </div>

      {/* Ações */}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg border border-input bg-surface text-foreground px-6 py-3 disabled:opacity-50">
          Voltar
        </button>

        <button type="submit" disabled={loading} className="rounded-lg bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">
          {loading ? 'Cadastrando...' : 'Cadastrar variante'}
        </button>
      </div>
    </form>
  );
}
