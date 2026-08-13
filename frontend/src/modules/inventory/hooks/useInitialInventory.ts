import { useState } from "react";

import { api } from "@/shared/services/api";

interface Product {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  productId: string;
}

interface ScanResult {
  found: boolean;
  barcode: string;
  product?: Product;
}

export function useInitialInventory() {
  const [isLoading, setIsLoading] = useState(false);

  const [productNotFound, setProductNotFound] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  async function scanProduct(barcode: string) {
    setIsLoading(true);

    try {
      const response = await api.get<ScanResult>(
        `/products/barcode/${barcode}`,
      );

      const result = response.data;

      if (!result.found) {
        setSelectedProduct(null);
        setProductNotFound(barcode);
        return;
      }

      setProductNotFound(null);
      setSelectedProduct(result.product ?? null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  function clearProduct() {
    setSelectedProduct(null);
    setProductNotFound(null);
  }

  return {
    isLoading,
    selectedProduct,
    productNotFound,
    scanProduct,
    clearProduct,
  };
}
