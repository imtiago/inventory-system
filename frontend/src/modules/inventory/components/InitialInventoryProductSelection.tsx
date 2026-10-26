import { useEffect, useState } from 'react';
import { useFinePointer } from '@/shared/hooks/useMediaQuery';

import type { InventoryProductSearchResult } from '../hooks/useSearchProducts';
import { LoadingState } from '@/shared/components/LoadingState';

interface Props {
  products: InventoryProductSearchResult[];

  loading: boolean;

  error: string | null;

  onSearch(search: string): void;

  onSelect(product: InventoryProductSearchResult): void;

  onBack(): void;
}

export function InitialInventoryProductSelection({ products, loading, error, onSearch, onSelect, onBack }: Props) {
  const finePointer = useFinePointer();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(search);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSearch is recreated every render
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface p-6 shadow">
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
            className="w-full rounded-lg border border-input bg-surface text-foreground p-3"
            autoFocus={finePointer}
          />
        </div>
      </div>

      {loading && <LoadingState label="Carregando produtos..." compact />}

      {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-danger">{error}</div>}

      {!loading && !error && products.length === 0 && (
        <div className="rounded-xl bg-surface p-6 text-center shadow">
          <p className="text-muted">Nenhum produto encontrado.</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="space-y-3">
          {products.map((product) => (
            <button key={product.id} type="button" onClick={() => onSelect(product)} className="w-full rounded-xl bg-surface p-5 text-left shadow transition hover:bg-surface-muted">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{product.name}</h2>

                  <p className="mt-1 font-mono text-sm text-muted">{product.code}</p>

                  {product.description && <p className="mt-2 text-sm text-muted">{product.description}</p>}
                </div>

                {product.variantsCount !== undefined && (
                  <span className="rounded-lg bg-surface-muted px-3 py-1 text-sm">
                    {product.variantsCount} {product.variantsCount === 1 ? 'variante' : 'variantes'}
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-4 text-sm text-muted">
                {product.brand && <span>Marca: {product.brand.name}</span>}

                {product.category && <span>Categoria: {product.category.name}</span>}
              </div>

              <div className="mt-4 text-sm font-medium text-primary">Selecionar produto →</div>
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={onBack} className="rounded-lg border border-input bg-surface text-foreground px-6 py-3">
        Voltar
      </button>
    </div>
  );
}
