import { useState } from 'react';

import { ProductVariantRegistration } from './ProductVariantRegistration';
import { useProductVariantOptions } from '../hooks/useProductVariantOptions';
import type { ProductVariant } from '../types';

interface InitialInventoryVariantRegistrationProps {
  /** Scanned barcode that was not found; null when registering without barcode. */
  barcode: string | null;
  productId: string;
  productName: string;
  onCancel: () => void;
  onChosen: (variant: ProductVariant) => void;
}

/**
 * With a scanned (unknown) barcode a new variant is created for it.
 * Without barcode the product's existing variants are listed to pick one, or a new one is created.
 */
export function InitialInventoryVariantRegistration({ barcode, productId, productName, onCancel, onChosen }: InitialInventoryVariantRegistrationProps) {
  const [creating, setCreating] = useState(Boolean(barcode));
  const { variants, isLoading, error } = useProductVariantOptions(barcode ? undefined : productId);

  if (creating) {
    return <ProductVariantRegistration barcode={barcode} productId={productId} productName={productName} onSuccess={onChosen} onCancel={barcode ? onCancel : () => setCreating(false)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Escolher variante</h2>

        <p className="mt-1 text-gray-500">
          Produto: <strong>{productName}</strong>
        </p>
      </div>

      <div className="space-y-3 rounded-xl bg-white p-6 shadow">
        {isLoading && <p className="text-sm text-gray-500">Carregando variantes...</p>}

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isLoading && !error && variants.length === 0 && <p className="text-sm text-gray-500">Este produto ainda não possui variantes.</p>}

        {variants.map((variant) => (
          <button key={variant.id} type="button" onClick={() => onChosen(variant)} className="w-full rounded-lg border p-4 text-left hover:bg-gray-50">
            <span className="block font-semibold">{variant.name}</span>
            <span className="block font-mono text-sm text-gray-500">{variant.code}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg border px-6 py-3">
          Voltar
        </button>

        <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-black px-6 py-3 text-white">
          Cadastrar nova variante
        </button>
      </div>
    </div>
  );
}
