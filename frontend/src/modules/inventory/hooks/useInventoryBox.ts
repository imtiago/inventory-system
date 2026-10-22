import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/react-query/keys';
import { addLotToBox, createInventoryBox, listInventoryBoxes, type AddLotToBoxDTO } from '../services/inventoryService';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { invalidateInventoryQueries } from '../utils/invalidateInventoryQueries';

/** Any box, searched by code (GET /inventory/boxes?search). */
export function useInventoryBoxes(search: string, enabled = true) {
  const term = search.trim();

  const query = useQuery({
    queryKey: queryKeys.inventoryBoxes(term),
    queryFn: () => listInventoryBoxes(term || undefined),
    enabled,
  });

  return {
    boxes: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? apiErrorMessage(query.error, 'Não foi possível carregar as caixas.') : null,
  };
}

export function useInventoryBox() {
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function createBox() {
    try {
      setLoading(true);
      setError(null);

      const result = await createInventoryBox();

      await invalidateInventoryQueries(queryClient);

      return result;
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Não foi possível criar a caixa.'));

      return null;
    } finally {
      setLoading(false);
    }
  }

  async function addLot(boxId: string, data: AddLotToBoxDTO, variantId?: string) {
    try {
      setLoading(true);
      setError(null);

      const result = await addLotToBox(boxId, data);

      void invalidateInventoryQueries(queryClient, variantId);

      return result;
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Não foi possível adicionar o lote à caixa.'));

      return null;
    } finally {
      setLoading(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return {
    createBox,
    addLot,
    loading,
    error,
    clearError,
  };
}
