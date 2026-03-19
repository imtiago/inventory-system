// src/modules/products/components/ProductTable.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteProduct } from "../hooks/useDeleteProduct";
import type { Product } from "../types";
import StockBadge from "./StockBadge";

interface ProductTableProps {
  products: Product[];
}

export const ProductTable: React.FC<ProductTableProps> = ({ products }) => {
  const navigate = useNavigate();
  const deleteProductMutation = useDeleteProduct();

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Deseja realmente excluir o produto "${name}"?`)) {
      deleteProductMutation.mutate(id);
    }
  };

  return (
    <table className="w-full border">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Marca</th>
          <th>Categoria</th>
          <th>SKU / Variantes</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td>{product.name}</td>
            <td>{product.brand?.name || "-"}</td>
            <td>{product.category?.name || "-"}</td>
            <td>
              {product.variants.length > 0
                ? `${product.variants[0].sku} (${product.variants.length})`
                : "-"}
            </td>
            <td>
              <button
                onClick={() => navigate(`/products/${product.id}/edit`)}
                className="mr-2"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(product.id, product.name)}
                className="text-red-500"
              >
                Excluir
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
