import { useNavigate } from "react-router-dom";

import { ProductForm, type ProductFormData } from "../components/ProductForm";

import { useCreateProduct } from "../hooks/useCreateProduct";
import { PageContainer } from "@/shared/components/PageContainer";

export function ProductCreatePage() {
  const navigate = useNavigate();

  const createProduct = useCreateProduct();

  async function handleSubmit(data: ProductFormData) {
    const product = await createProduct.mutateAsync(data);

    navigate(`/products/${product.id}`);
  }

  return (
    <PageContainer>
      <ProductForm
        title="Novo Produto"
        description="Cadastre um novo produto no catálogo."
        onSubmit={handleSubmit}
        onCancel={() => navigate("/products")}
      />
    </PageContainer>
  );
}
