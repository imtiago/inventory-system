// src/modules/inventory/hooks/useInventoryLots.ts

import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import type { InventoryLotListResponse } from '../types/InventoryLotTypes';

export function useInventoryLots(productVariantId: string) {
  return useQuery<InventoryLotListResponse>({
    queryKey: ['inventory-lots', productVariantId],
    queryFn: async () => {
      const response = await api.get<InventoryLotListResponse>(`/inventory/variants/${productVariantId}/lots`);

      return response.data;
    },
    enabled: Boolean(productVariantId),
  });
}
