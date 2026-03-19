// src/modules/products/pages/ScanProductPage.tsx
import { useState } from "react";
import { ProductForm } from "../components/ProductForm";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export const ScanProductPage = () => {
  const [barcode, setBarcode] = useState<string | null>(null);

  const handleDetected = (code: string) => {
    setBarcode(code);
  };

  return (
    <div className="p-4">
      <h1>Cadastro de Produto via Código de Barras</h1>

      {!barcode && (
        <>
          <p>Aponte a câmera para o código de barras</p>
          <BarcodeScanner onDetected={handleDetected} />
        </>
      )}

      {barcode && (
        <ProductForm
          defaultValues={{ barcode, name: "", sku: "" }}
          autoSubmitBarcode={false}
          onSuccess={() => setBarcode(null)}
        />
      )}
    </div>
  );
};
