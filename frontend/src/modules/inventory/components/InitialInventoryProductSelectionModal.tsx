import { useState } from 'react';

import type { ProductListItem } from '../types/ProductTypes';

interface Props {
  open: boolean;
  products: ProductListItem[];
  loading: boolean;
  error: string | null;
  onSearch(search: string): void;
  onSelect(product: ProductListItem): void;
  onClose(): void;
}

export function InitialInventoryProductSelectionModal({ open, products, loading, error, onSearch, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');

  if (!open) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    onSearch(search.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Selecionar produto</h2>

          <p className="mt-1 text-sm text-gray-500">Selecione o produto ao qual a nova variante será vinculada.</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código ou nome..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-blue-500"
            />

            <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700">
              Buscar
            </button>
          </form>

          {loading && <div className="py-8 text-center text-sm text-gray-500">Carregando produtos...</div>}

          {error && !loading && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}

          {!loading && !error && products.length === 0 && <div className="py-8 text-center text-sm text-gray-500">Nenhum produto encontrado.</div>}

          {!loading && products.length > 0 && (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product)}
                  className="w-full rounded-xl border border-gray-200 p-4 text-left transition hover:border-blue-500 hover:bg-blue-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{product.name}</p>

                      <p className="mt-1 text-sm text-gray-500">Código: {product.code}</p>

                      <p className="text-sm text-gray-500">
                        {product.brand.name} • {product.category.name}
                      </p>
                    </div>

                    <span className="text-sm text-gray-400">
                      {product.variantsCount} {product.variantsCount === 1 ? 'variante' : 'variantes'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
