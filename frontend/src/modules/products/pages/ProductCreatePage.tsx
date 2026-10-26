import { useNavigate } from "react-router-dom";

import { ProductForm, type ProductFormData } from "../components/ProductForm";

import { useCreateProduct } from "../hooks/useCreateProduct";
import { Page } from "@/shared/components/layout/Page";

export function ProductCreatePage() {
  const navigate = useNavigate();

  const createProduct = useCreateProduct();

  async function handleSubmit(data: ProductFormData) {
    const product = await createProduct.mutateAsync(data);

    navigate(`/products/${product.id}`);
  }

  return (
    <Page width="narrow">
      <ProductForm
        title="Novo Produto"
        description="Cadastre um novo produto no catálogo."
        withSalePrice
        onSubmit={handleSubmit}
        backPath="/products"
        backLabel="produtos"
        onCancel={() => navigate("/products")}
      />
    </Page>
  );
}
