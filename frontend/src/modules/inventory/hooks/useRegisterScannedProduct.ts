import { useState } from 'react';
import { api } from '@/shared/services/api';

export interface RegisterScannedProductInput {
  barcode: string;
  boxCode: string;
  batchNumber?: string;
  expirationDate?: Date;
  quantity?: number;
}

export interface RegisterScannedProductResponse {
  productVariantId: string;
  productCode: string;
  barcode: string | null;
  boxId: string;
  boxCode: string;
  inventoryLotId: string;
}

export function useRegisterScannedProduct() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register(data: RegisterScannedProductInput): Promise<RegisterScannedProductResponse | null> {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/inventory/initial-count', data);

      return response.data.data ?? null;
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Não foi possível registrar o produto.';

      setError(message);

      return null;
    } finally {
      setLoading(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return {
    loading,
    error,
    register,
    clearError,
  };
}
