import { useState } from 'react';

import { api } from '@/shared/services/api';

interface GenerateProductLabelsInput {
  boxCode: string;
  productCode: string;
  quantity: number;
}

interface GenerateProductLabelsResponse {
  productCode: string;
  quantity: number;
}

export function useGenerateProductLabels() {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function generateProductLabels(data: GenerateProductLabelsInput): Promise<GenerateProductLabelsResponse | null> {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(`/inventory/boxes/code/${data.boxCode}/product-labels`, {
        productCode: data.productCode,
        quantity: data.quantity,
      });

      return response.data.data ?? response.data;
    } catch (error: any) {
      setError(error?.response?.data?.message ?? 'Não foi possível gerar as etiquetas.');

      return null;
    } finally {
      setLoading(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return {
    generateProductLabels,
    loading,
    error,
    clearError,
  };
}
