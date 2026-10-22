import { useState } from 'react';

import { api } from '@/shared/services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';

const FALLBACK = 'Não foi possível gerar as etiquetas.';

/** With responseType "blob" the error body arrives as a Blob; read its JSON `{ message }`. */
async function labelErrorMessage(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;

  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: unknown };

      return typeof parsed.message === 'string' && parsed.message ? parsed.message : FALLBACK;
    } catch {
      return FALLBACK;
    }
  }

  return apiErrorMessage(error, FALLBACK);
}

export function useGenerateInventoryProductLabels() {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function generate(boxCode: string, productCode: string, quantity: number): Promise<boolean> {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(
        `/inventory/boxes/code/${encodeURIComponent(boxCode)}/product-labels`,
        { productCode, quantity },
        { responseType: 'blob' },
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });

      const url = window.URL.createObjectURL(blob);

      window.open(url, '_blank');

      return true;
    } catch (err: unknown) {
      setError(await labelErrorMessage(err));

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
