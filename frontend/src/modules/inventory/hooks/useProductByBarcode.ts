import { useState } from 'react';

import { api } from '@/shared/services/api';

import type { ProductVariant } from '../types/InitialInventoryTypes';

export function useProductByBarcode() {
  const [foundVariant, setFoundVariant] = useState<ProductVariant | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function searchByBarcode(barcode: string): Promise<ProductVariant | null> {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/variants/barcode/${encodeURIComponent(barcode)}`);

      const variant = response.data.data ?? null;

      setFoundVariant(variant);

      return variant;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setFoundVariant(null);
        return null;
      }

      setFoundVariant(null);

      setError(error?.response?.data?.message ?? 'Não foi possível consultar o código de barras.');

      return null;
    } finally {
      setLoading(false);
    }
  }

  function clearFoundVariant() {
    setFoundVariant(null);
    setError(null);
  }

  return {
    foundVariant,
    loading,
    error,

    searchByBarcode,
    clearFoundVariant,
  };
}
