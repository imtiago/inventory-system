import { useState } from 'react';

import { api } from '@/shared/services/api';
import { notify } from '@/shared/utils/notify';

interface ProductVariantRegistrationProps {
  barcode: string;
  productId: string;
  productName: string;
  onSuccess: (variant: { id: string; name: string; code: string; barcode: string | null; productId: string }) => void;
  onCancel: () => void;
}

export function ProductVariantRegistration({ barcode, productId, productName, onSuccess, onCancel }: ProductVariantRegistrationProps) {
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

      const response = await api.post(`/products/${productId}/variants`, {
        name: name.trim(),
        barcode,
      });

      const variant = response.data.data ?? response.data;

      notify.success('Variante cadastrada com sucesso!');

      onSuccess(variant);
    } catch (error: any) {
      console.error('Erro ao cadastrar variante:', error);

      const message = error?.response?.data?.message || 'Não foi possível cadastrar a variante.';

      notify.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cadastrar variante</h1>

        <p className="mt-1 text-gray-500">O código de barras ainda não está cadastrado.</p>
      </div>

      <div className="space-y-5 rounded-xl bg-white p-6 shadow">
        {/* Produto */}

        <div>
          <label className="mb-1 block text-sm text-gray-500">Produto</label>

          <input value={productName} readOnly className="w-full rounded-lg border bg-gray-100 p-3" />
        </div>

        {/* Barcode */}

        <div>
          <label className="mb-1 block text-sm text-gray-500">Código de barras</label>

          <input value={barcode} readOnly className="w-full rounded-lg border bg-gray-100 p-3 font-mono" />
        </div>

        {/* Nome da variante */}

        <div>
          <label className="mb-1 block">Nome da variante</label>

          <input
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
