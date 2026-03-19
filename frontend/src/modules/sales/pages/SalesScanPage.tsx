// src/modules/sales/pages/SalesScanPage.tsx
import { useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useProducts } from "@/modules/products/hooks/useProducts";

export const SalesScanPage = () => {
  const [cart, setCart] = useState<any[]>([]);
  const [barcode, setBarcode] = useState<string | null>(null);
  const { data: products } = useProducts("");

  const handleDetected = (code: string) => {
    const product = products?.find((p) =>
      p.variants.some((v) => v.barcode === code),
    );
    if (!product) return alert("Produto não encontrado!");

    setCart((prev) => [...prev, { ...product, quantity: 1 }]);
    setBarcode(null); // pronto para próxima leitura
  };

  return (
    <div className="p-4">
      <h1>Vendas via Código de Barras</h1>
      <BarcodeScanner onDetected={handleDetected} stopAfterDetection={true} />

      <h2>Carrinho</h2>
      {cart.length === 0 && <p>Nenhum produto adicionado.</p>}
      {cart.map((item, idx) => (
        <div key={idx}>
          {item.name} - Qty: {item.quantity}
        </div>
      ))}
    </div>
  );
};
