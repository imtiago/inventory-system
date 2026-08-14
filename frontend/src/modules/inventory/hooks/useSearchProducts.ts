import { useState } from 'react';
import { api } from '@/shared/services/api';

export interface InventoryProductSearchResult {
  id: string;
  name: string;
  code: string;
  description: string | null;

  brand?: {
    id: string;
    name: string;
  };

  category?: {
    id: string;
    name: string;
  };

  variantsCount?: number;
}

interface SearchProductsResponse {
  data: InventoryProductSearchResult[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useSearchProducts() {
  const [products, setProducts] = useState<InventoryProductSearchResult[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function searchProducts(search: string) {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<SearchProductsResponse>('/products', {
        params: {
          page: 1,
          limit: 20,
          search: search.trim(),
        },
      });

      setProducts(response.data.data ?? []);
    } catch (error) {
      console.error('Erro ao pesquisar produtos:', error);

      setError('Não foi possível pesquisar os produtos.');

      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function clearProducts() {
    setProducts([]);
    setError(null);
  }

  return {
    products,
    loading,
    error,
    searchProducts,
    clearProducts,
  };
}
