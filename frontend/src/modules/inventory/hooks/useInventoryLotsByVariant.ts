import { useState } from 'react';
import { api } from '@/shared/services/api';

import type { InventoryLot } from '../types/InitialInventoryTypes';

export function useInventoryLotsByVariant() {
  const [lots, setLots] = useState<InventoryLot[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function findLots(productVariantId: string) {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/inventory/variants/${productVariantId}/lots`);

      const data = response.data.data ?? [];

      setLots(data);

      return data;
    } catch (error: any) {
      setLots([]);

      setError(error?.response?.data?.message ?? 'Não foi possível carregar os lotes.');

      return [];
    } finally {
      setLoading(false);
    }
  }

  function clearLots() {
    setLots([]);
    setError(null);
  }

  return {
    lots,
    loading,
    error,
    findLots,
    clearLots,
  };
}
