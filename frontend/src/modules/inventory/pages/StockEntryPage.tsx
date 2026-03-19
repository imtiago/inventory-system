// src/modules/inventory/pages/StockEntryPage.tsx
import { useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useProducts } from "@/modules/products/hooks/useProducts";
import { useUpdateProduct } from "@/modules/products/hooks/useUpdateProduct";
import { Input, Button } from "@/components/ui";

export const StockEntryPage = () => {
  const [barcode, setBarcode] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const { data: products } = useProducts(""); // fetch all products, filtramos pelo barcode
  const { mutate: update } = useUpdateProduct();

  const handleDetected = (code: string) => setBarcode(code);

  const product = products?.find((p) =>
    p.variants.some((v) => v.barcode === barcode),
  );

  const handleSubmit = () => {
    if (!product) return alert("Produto não encontrado!");
    // exemplo simples: atualiza estoque no backend
    update(
      {
        id: product.id,
        input: {
          // aqui seria sua lógica para atualizar quantidade
          stock: (product.stock || 0) + quantity,
        },
      },
      { onSuccess: () => setBarcode(null) },
    );
  };

  return (
    <div className="p-4">
      <h1>Entrada de Estoque</h1>

      {!barcode && <BarcodeScanner onDetected={handleDetected} />}

      {barcode && product && (
        <div className="space-y-4 max-w-md">
          <p>Produto: {product.name}</p>
          <p>Barcode: {barcode}</p>

          <div>
            <label>Quantidade</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <Button onClick={handleSubmit}>Adicionar Estoque</Button>
        </div>
      )}

      {barcode && !product && (
        <p>Produto não encontrado. Cadastre-o primeiro!</p>
      )}
    </div>
  );
};
