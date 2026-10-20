import { useState } from 'react';

import { api } from '@/shared/services/api';

export function useGenerateInventoryProductLabels() {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function generate(boxCode: string, productCode: string, quantity: number): Promise<boolean> {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(
        `/inventory/boxes/code/${boxCode}/product-labels`,
        {
          productCode,
          quantity,
        },
        {
          responseType: 'blob',
        },
      );

      const blob = new Blob([response.data], {
        type: 'application/pdf',
      });

      const url = window.URL.createObjectURL(blob);

      window.open(url, '_blank');

      return true;
    } catch (error: any) {
      setError(error?.response?.data?.message ?? 'Não foi possível gerar as etiquetas.');

      return false;
    } finally {
      setLoading(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return {
    generate,
    loading,
    error,
    clearError,
  };
}
