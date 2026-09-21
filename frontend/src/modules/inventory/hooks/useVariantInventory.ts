import { useEffect, useState } from 'react';
import { getVariantInventory } from '../services/inventoryService';

export function useVariantInventory(productVariantId?: string) {
  const [inventory, setInventory] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function loadInventory() {
    if (!productVariantId) {
      setInventory(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getVariantInventory(productVariantId);

      setInventory(data);
    } catch (error: any) {
      setInventory(null);

      setError(error?.response?.data?.message ?? 'Não foi possível carregar o estoque da variante.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, [productVariantId]);

  return {
    inventory,
    loading,
    error,
    reload: loadInventory,
  };
}
