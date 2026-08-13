import { useState } from "react";
import { api } from "@/shared/services/api";

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

export function useInventoryBoxByLot() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function findBoxByLot(
    productVariantId: string,
    batchNumber: string,
  ): Promise<InventoryBox | null> {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get("/inventory/boxes/by-lot", {
        params: {
          productVariantId,
          batchNumber,
        },
      });

      return response.data.data ?? null;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }

      setError("Não foi possível verificar a caixa.");

      return null;
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
