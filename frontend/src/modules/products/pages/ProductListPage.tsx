import React, { useState } from "react";
import { useProducts } from "../hooks/useProducts";
import { ProductTable } from "../components/ProductTable";

export const ProductListPage = () => {
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useProducts(search);

  if (isLoading) return <p>Carregando...</p>;
  if (!products?.length) return <p>Nenhum produto encontrado</p>;

  return (
    <div>
      <h1>Produtos</h1>
      <input
        type="text"
        placeholder="Buscar produto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 p-2 border rounded"
      />
      <ProductTable products={products} />
    </div>
  );
};
