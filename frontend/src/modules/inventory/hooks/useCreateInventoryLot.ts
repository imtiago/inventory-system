import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createInventoryLot, type CreateInventoryLotDTO } from '../services/inventoryService';
import type { InventoryLot } from '../types';
import { apiErrorMessage, type MutationResult } from '../utils/apiErrorMessage';
import { invalidateInventoryQueries } from '../utils/invalidateInventoryQueries';

export function useCreateInventoryLot() {
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /** Returns the outcome without touching `error` (the wizard owns its error state). */
  async function tryCreate(data: CreateInventoryLotDTO): Promise<MutationResult<InventoryLot>> {
    try {
      setLoading(true);

      const lot = await createInventoryLot(data);

      void invalidateInventoryQueries(queryClient, data.productVariantId);

      return { ok: true, data: lot };
    } catch (err: unknown) {
      return { ok: false, error: apiErrorMessage(err, 'Não foi possível criar o lote.') };
    } finally {
      setLoading(false);
    }
  }

  async function create(data: CreateInventoryLotDTO) {
    setError(null);

    const result = await tryCreate(data);

    if (!result.ok) {
      setError(result.error);
      return null;
    }

    return result.data;
  }

  function clearError() {
    setError(null);
  }

  return {
    create,
    tryCreate,
    loading,
    error,
    clearError,
  };
}
