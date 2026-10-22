import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/services/api';
import { queryKeys } from '@/shared/react-query/keys';
import type { Paginated, ProductVariant } from '../types';
import { apiErrorMessage } from '../utils/apiErrorMessage';

/** Existing variants of a product (GET /products/:id/variants), for the wizard without barcode. */
export function useProductVariantOptions(productId: string | undefined) {
  const query = useQuery({
    queryKey: [...queryKeys.productVariants(productId ?? ''), { page: 1, limit: 100 }],
    queryFn: async () => {
      const response = await api.get<Paginated<ProductVariant>>(`/products/${productId}/variants`, { params: { page: 1, limit: 100 } });

      return response.data.data ?? [];
    },
    enabled: Boolean(productId),
  });

  return {
    variants: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? apiErrorMessage(query.error, 'Não foi possível carregar as variantes.') : null,
  };
}
