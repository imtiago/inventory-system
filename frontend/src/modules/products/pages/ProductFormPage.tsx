import React from "react";
import { useNavigate } from "react-router-dom";
import { ProductForm } from "../components/ProductForm";

export const ProductFormPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <h1 className="text-3xl mb-6">Novo Produto</h1>
      <ProductForm onSuccess={() => navigate("/products")} />
    </div>
  );
};
