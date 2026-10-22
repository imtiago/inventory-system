import { useState } from 'react';

import { api } from '@/shared/services/api';
import { parseApiError } from '@/shared/services/parseApiError';
import type { MutationResult } from '../utils/apiErrorMessage';

const FALLBACK = 'Não foi possível gerar as etiquetas.';

/** With responseType "blob" the error body arrives as a Blob; parseApiError reads it. */
async function labelErrorMessage(error: unknown): Promise<string> {
  const parsed = await parseApiError(error);

  return parsed.code === 'UNKNOWN_ERROR' ? FALLBACK : parsed.message;
}

export function useGenerateInventoryProductLabels() {
  const [loading, setLoading] = useState(false);

  async function generate(boxCode: string, productCode: string, quantity: number): Promise<MutationResult<true>> {
    try {
      setLoading(true);

      const response = await api.post(
        `/inventory/boxes/code/${encodeURIComponent(boxCode)}/product-labels`,
        { productCode, quantity },
        { responseType: 'blob' },
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });

      const url = window.URL.createObjectURL(blob);

      window.open(url, '_blank');

      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: await labelErrorMessage(err) };
    } finally {
      setLoading(false);
    }
  }

  return {
    generate,
    loading,
  };
}
