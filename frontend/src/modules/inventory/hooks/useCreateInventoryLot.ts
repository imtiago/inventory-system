import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createInventoryLot, type CreateInventoryLotDTO } from '../services/inventoryService';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { invalidateInventoryQueries } from '../utils/invalidateInventoryQueries';

export function useCreateInventoryLot() {
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function create(data: CreateInventoryLotDTO) {
    try {
      setLoading(true);
      setError(null);

      const result = await createInventoryLot(data);

      void invalidateInventoryQueries(queryClient, data.productVariantId);

      return result;
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Não foi possível criar o lote.'));

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
