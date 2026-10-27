import { useNavigate } from "react-router-dom";

import { ProductForm, type ProductFormData } from "../components/ProductForm";

import { useApplyTargetMargin } from "@/modules/pricing/hooks/usePricingMutations";
import { useCreateProduct } from "../hooks/useCreateProduct";
import { Page } from "@/shared/components/layout/Page";

export function ProductCreatePage() {
  const navigate = useNavigate();

  const createProduct = useCreateProduct();
  const applyMargin = useApplyTargetMargin();

  async function handleSubmit(data: ProductFormData) {
    const product = await createProduct.mutateAsync(data);

    await applyMargin("product", product.id, data.targetMarginBps);

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
