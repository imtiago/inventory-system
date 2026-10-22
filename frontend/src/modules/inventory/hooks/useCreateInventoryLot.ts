import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createInventoryLot, type CreateInventoryLotDTO } from '../services/inventoryService';
import type { InventoryLot } from '../types';
import { apiErrorMessage, type MutationResult } from '../utils/apiErrorMessage';
import { invalidateInventoryQueries } from '../utils/invalidateInventoryQueries';

export function useCreateInventoryLot() {
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);

  /** Returns the outcome; the wizard owns its error state. */
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

  return {
    tryCreate,
    loading,
  };
}
