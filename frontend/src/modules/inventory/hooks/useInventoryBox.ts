import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useIdempotencyKey } from '@/shared/utils/idempotencyKey';
import { queryKeys } from '@/shared/react-query/keys';
import { addLotToBox, createInventoryBox, listInventoryBoxes, type AddLotToBoxDTO, type BoxItem } from '../services/inventoryService';
import type { InventoryBox } from '../types';
import { apiErrorMessage, type MutationResult } from '../utils/apiErrorMessage';
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
  const keys = useIdempotencyKey();

  const [loading, setLoading] = useState(false);

  async function createBox(): Promise<MutationResult<InventoryBox>> {
    try {
      setLoading(true);

      const box = await createInventoryBox();

      void invalidateInventoryQueries(queryClient);

      return { ok: true, data: box };
    } catch (err: unknown) {
      return { ok: false, error: apiErrorMessage(err, 'Não foi possível criar a caixa.') };
    } finally {
      setLoading(false);
    }
  }

  async function addLot(boxId: string, data: AddLotToBoxDTO, variantId?: string): Promise<MutationResult<BoxItem>> {
    try {
      setLoading(true);

      const item = await keys.run({ boxId, data }, (key) => addLotToBox(boxId, data, key));

      void invalidateInventoryQueries(queryClient, variantId);

      return { ok: true, data: item };
    } catch (err: unknown) {
      return { ok: false, error: apiErrorMessage(err, 'Não foi possível adicionar o lote à caixa.') };
    } finally {
      setLoading(false);
    }
  }

  return {
    createBox,
    addLot,
    loading,
  };
}
