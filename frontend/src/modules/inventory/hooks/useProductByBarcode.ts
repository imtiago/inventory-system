import { useState } from "react";
import { api } from "@/shared/services/api";

export interface ProductByBarcode {
  id: string;
  barcode: string;
  code: string;
  name: string;
  productId: string;
  createdAt: string;
}

interface ProductByBarcodeResponse {
  data: ProductByBarcode;
}

export function useProductByBarcode() {
  const [product, setProduct] = useState<ProductByBarcode | null>(null);

  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  async function findByBarcode(barcode: string) {
    setLoading(true);

    setProduct(null);
    setNotFoundBarcode(null);

    try {
      const response = await api.get<ProductByBarcodeResponse>(
        `/variants/barcode/${barcode}`,
      );

      const product = response.data.data;

      setProduct(product);
    } catch (error: any) {
      console.error("Erro ao buscar produto por código de barras:", error);

      /*
       * Se a API retornar 404, significa que
       * o produto não está cadastrado.
       */
      if (error.response?.status === 404) {
        setNotFoundBarcode(barcode);
      }
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setProduct(null);
    setNotFoundBarcode(null);
  }

  return {
    product,
    notFoundBarcode,
    loading,
    findByBarcode,
    clear,
  };
}
