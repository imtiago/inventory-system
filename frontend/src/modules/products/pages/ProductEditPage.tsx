// src/modules/products/pages/ProductEditPage.tsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProductById } from "../services/productService";
import { ProductForm } from "../components/ProductForm";
import type { Product } from "../types";

export const ProductEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery<Product | undefined>({
    queryKey: ["product", id],
    queryFn: () => getProductById(id!),
    enabled: !!id,
  });

  if (isLoading) return <p>Carregando produto...</p>;
  if (!product) return <p>Produto não encontrado</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl mb-6">Editar Produto</h1>
      <ProductForm
        defaultValues={{
          name: product.name,
          sku: product.variants?.[0]?.sku || "", // primeira variante como padrão
          brandId: product.brandId || "",
          categoryId: product.categoryId || "",
        }}
        productId={id}
        onSuccess={() => navigate("/products")}
      />
    </div>
  );
};
