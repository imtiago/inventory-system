import { useNavigate } from "react-router-dom";

import { ProductForm, type ProductFormData } from "../components/ProductForm";

import { useBrands } from "@/modules/brands/hooks/useBrands";
import { useCategories } from "@/modules/categories/hooks/useCategories";
import { useCreateProduct } from "../hooks/useCreateProduct";
import { PageContainer } from "@/shared/components/PageContainer";

export function ProductCreatePage() {
  const navigate = useNavigate();

  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
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
        brands={brands}
        categories={categories}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/products")}
      />
    </PageContainer>
  );
}
