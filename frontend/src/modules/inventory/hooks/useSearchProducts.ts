import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/services/api';
import type { Paginated } from '@/shared/types/pagination';

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

type SearchProductsResponse = Paginated<InventoryProductSearchResult>;

/**
 * Wizard product search. The term is part of the query key, so an old, slower response
 * lands in its own cache entry and never replaces the results of the current term.
 */
export function useSearchProducts() {
  // null = no search requested yet (modal closed): nothing is fetched.
  const [term, setTerm] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['products', 'wizard-search', term],
    queryFn: async ({ signal }) => {
      const response = await api.get<SearchProductsResponse>('/products', {
        params: { page: 1, limit: 20, search: term },
        signal,
      });

      return response.data.data ?? [];
    },
    enabled: term !== null,
  });

  function searchProducts(search: string) {
    setTerm(search.trim());
  }

  function clearProducts() {
    setTerm(null);
  }

  return {
    products: term === null ? [] : (query.data ?? []),
    loading: term !== null && query.isFetching,
    error: term !== null && query.isError ? 'Não foi possível pesquisar os produtos.' : null,
    searchProducts,
    clearProducts,
  };
}
