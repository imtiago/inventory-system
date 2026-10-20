import { useEffect, useState } from 'react';

import type { ProductListItem } from '../types/ProductTypes';

interface Props {
  barcode: string | null;

  products: ProductListItem[];

  loading: boolean;

  error: string | null;

  onSearch(search: string): void;

  onSelect(product: ProductListItem): void;

  onBack(): void;
}

export function InitialInventoryProductSelection({ barcode, products, loading, error, onSearch, onSelect, onBack }: Props) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <div className="mt-2">
          <label htmlFor="product-search" className="mb-1 block font-medium">
            Pesquisar produto
          </label>

          <input
            id="product-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite o nome ou código do produto..."
            className="w-full rounded-lg border p-3"
            autoFocus
          />
        </div>
      </div>

      {loading && <div className="rounded-xl bg-white p-6 text-center shadow">Carregando produtos...</div>}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      {!loading && !error && products.length === 0 && (
        <div className="rounded-xl bg-white p-6 text-center shadow">
          <p className="text-gray-500">Nenhum produto encontrado.</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="space-y-3">
          {products.map((product) => (
            <button key={product.id} type="button" onClick={() => onSelect(product)} className="w-full rounded-xl bg-white p-5 text-left shadow transition hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{product.name}</h2>

                  <p className="mt-1 font-mono text-sm text-gray-500">{product.code}</p>

                  {product.description && <p className="mt-2 text-sm text-gray-500">{product.description}</p>}
                </div>

                <span className="rounded-lg bg-gray-100 px-3 py-1 text-sm">
                  {product.variantsCount} {product.variantsCount === 1 ? 'variante' : 'variantes'}
                </span>
              </div>

              <div className="mt-4 flex gap-4 text-sm text-gray-500">
                <span>Marca: {product.brand.name}</span>

                <span>Categoria: {product.category.name}</span>
              </div>

              <div className="mt-4 text-sm font-medium text-blue-600">Selecionar produto →</div>
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={onBack} className="rounded-lg border px-6 py-3">
        Voltar
      </button>
    </div>
  );
}
