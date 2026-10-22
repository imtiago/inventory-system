import { useState } from 'react';

import { api } from '@/shared/services/api';
import { parseApiErrorSync } from '@/shared/services/parseApiError';

import type { ProductVariant } from '../types/InitialInventoryTypes';
import { apiErrorMessage } from '../utils/apiErrorMessage';

export type BarcodeLookupResult = { status: 'found'; variant: ProductVariant } | { status: 'not-found' } | { status: 'error'; message: string };

export function useProductByBarcode() {
  const [foundVariant, setFoundVariant] = useState<ProductVariant | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /** Distinguishes "not found" (404) from network/server errors. */
  async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
    setLoading(true);
    setError(null);
    setFoundVariant(null);

    try {
      const response = await api.get<{ data: ProductVariant | null }>(`/variants/barcode/${encodeURIComponent(barcode)}`);

      const variant = response.data.data ?? null;

      setFoundVariant(variant);

      return variant ? { status: 'found', variant } : { status: 'not-found' };
    } catch (err: unknown) {
      const parsed = parseApiErrorSync(err);

      if (parsed.status === 404 || parsed.code === 'VARIANT_NOT_FOUND') {
        return { status: 'not-found' };
      }

      const message = apiErrorMessage(err, 'Não foi possível consultar o código de barras.');

      setError(message);

      return { status: 'error', message };
    } finally {
      setLoading(false);
    }
  }

  /** Legacy API: the variant, or null when not found or on error (see `error`). */
  async function searchByBarcode(barcode: string): Promise<ProductVariant | null> {
    const result = await lookupBarcode(barcode);

    return result.status === 'found' ? result.variant : null;
  }

  function clearFoundVariant() {
    setFoundVariant(null);
    setError(null);
  }

  return {
    foundVariant,
    loading,
    error,

    lookupBarcode,
    searchByBarcode,
    clearFoundVariant,
  };
}
