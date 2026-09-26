import { useState } from 'react';

import { api } from '@/shared/services/api';

export interface InventoryBoxStock {
  boxId: string;

  inventoryLot: {
    id: string;
    productVariantId: string;
    batchNumber: string | null;
    createdAt: string;
    expirationDate: string | null;
  };

  productVariant: {
    id: string;
    name: string;
    code: string;
    barcode: string | null;
    createdAt: string;
    productId: string;
  };
}

export interface InventoryBox {
  id: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  stocks: InventoryBoxStock[];
}

interface InventoryBoxResponse {
  data: InventoryBox[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useInventoryBoxByLot() {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function findBoxByLot(productVariantId: string, batchNumber: string): Promise<InventoryBox[]> {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<InventoryBoxResponse>('/inventory/boxes/by-lot', {
        params: {
          productVariantId,
          batchNumber,
        },
      });

      return response.data.data ?? [];
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return [];
      }

      setError(error?.response?.data?.message ?? 'Não foi possível verificar as caixas.');

      return [];
    } finally {
      setLoading(false);
    }
  }

  function clearBox() {
    setError(null);
  }

  return {
    loading,
    error,
    findBoxByLot,
    clearBox,
  };
}
