import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/services/api';
import { queryKeys } from '@/shared/react-query/keys';
import { notify } from '@/shared/utils/notify';
import type { ProductVariant } from '../types';
import { apiErrorMessage } from '../utils/apiErrorMessage';

interface ProductVariantRegistrationProps {
  /** Scanned barcode not found in the catalog; null when registering without barcode. */
  barcode: string | null;
  productId: string;
  productName: string;
  onSuccess: (variant: ProductVariant) => void;
  onCancel: () => void;
}

export function ProductVariantRegistration({ barcode, productId, productName, onSuccess, onCancel }: ProductVariantRegistrationProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      notify.warning('Informe o nome da variante.');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post<{ data: ProductVariant }>(`/products/${productId}/variants`, {
        name: name.trim(),
        ...(barcode ? { barcode } : {}),
      });

      const variant = response.data.data;

      void queryClient.invalidateQueries({ queryKey: queryKeys.productVariants(productId) });

      notify.success('Variante cadastrada com sucesso!');

      onSuccess(variant);
    } catch (error: unknown) {
      notify.error(apiErrorMessage(error, 'Não foi possível cadastrar a variante.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Kaiak 100ml"
            disabled={loading}
            className="w-full rounded-lg border p-3 disabled:opacity-50"
          />

          <p className="mt-2 text-sm text-gray-500">Informe a descrição da apresentação do produto.</p>
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
