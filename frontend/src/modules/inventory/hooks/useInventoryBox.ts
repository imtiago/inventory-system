import { useState } from 'react';

import { addLotToBox, createInventoryBox, type AddLotToBoxDTO, type CreateInventoryBoxDTO } from '../services/inventoryService';

export function useInventoryBox() {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function createBox(data: CreateInventoryBoxDTO) {
    try {
      setLoading(true);
      setError(null);

      const result = await createInventoryBox(data);

      return result;
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Não foi possível criar a caixa.';

      setError(typeof message === 'string' ? message : 'Não foi possível criar a caixa.');

      return null;
    } finally {
      setLoading(false);
    }
  }

  async function addLot(boxId: string, data: AddLotToBoxDTO) {
    try {
      setLoading(true);
      setError(null);

      const result = await addLotToBox(boxId, data);

      return result;
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Não foi possível adicionar o lote à caixa.';

      setError(typeof message === 'string' ? message : 'Não foi possível adicionar o lote à caixa.');

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
