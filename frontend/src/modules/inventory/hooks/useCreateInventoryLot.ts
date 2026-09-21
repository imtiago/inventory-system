import { useState } from 'react';

import { createInventoryLot, type CreateInventoryLotDTO } from '../services/inventoryService';

export function useCreateInventoryLot() {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function create(data: CreateInventoryLotDTO) {
    try {
      setLoading(true);
      setError(null);

      const result = await createInventoryLot(data);

      return result;
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Não foi possível criar o lote.';

      setError(typeof message === 'string' ? message : 'Não foi possível criar o lote.');

      return null;
    } finally {
      setLoading(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return {
    create,
    loading,
    error,
    clearError,
  };
}
