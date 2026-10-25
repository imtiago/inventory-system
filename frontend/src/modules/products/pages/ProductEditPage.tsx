import { useNavigate, useParams } from "react-router-dom";

import { PageContainer } from "@/shared/components/PageContainer";
import { parseApiErrorSync } from "@/shared/services/parseApiError";
import { handleMutationError } from "@/shared/utils/mutation";
import { notify } from "@/shared/utils/notify";


import { ProductForm, type ProductFormData } from "../components/ProductForm";
import { useProduct } from "../hooks/useProduct";
import { useUpdateProduct } from "../hooks/useUpdateProduct";
import type { UpdateProductInput } from "../types";

export function ProductEditPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading, isError } = useProduct(id);
  const updateProduct = useUpdateProduct({ silentError: true });

  if (isLoading) return <p>Carregando produto...</p>;
  if (isError || !product) return <p>Produto não encontrado</p>;

  const initialValues: ProductFormData = {
    name: product.name,
    description: product.description ?? "",
    brandId: product.brand.id,
    categoryId: product.category.id,
  };

  async function handleSubmit(data: ProductFormData) {
    // Only changed fields are sent (the backend update is partial).
    const changes: UpdateProductInput = {};

    if (data.name.trim() !== initialValues.name) changes.name = data.name.trim();
    if ((data.description ?? "").trim() !== initialValues.description) changes.description = (data.description ?? "").trim();
    if (data.brandId !== initialValues.brandId) changes.brandId = data.brandId;
    if (data.categoryId !== initialValues.categoryId) changes.categoryId = data.categoryId;

    if (Object.keys(changes).length === 0) {
      notify.info("Nenhuma alteração para salvar.");
      return;
    }

    try {
      await updateProduct.mutateAsync({ id, input: changes });
    } catch (error) {
      // Field errors are shown inline by the form; anything else becomes a toast.
      if (Object.keys(parseApiErrorSync(error).fieldErrors).length > 0) throw error;

      handleMutationError(error, "Erro ao atualizar produto.");
      return;
    }

    navigate(`/products/${id}`);
  }

  return (
    <PageContainer>
      <ProductForm
        title="Editar Produto"
        description={`Código ${product.code}`}
        initialBrand={product.brand}
        initialCategory={product.category}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/products/${id}`)}
      />
    </PageContainer>
  );
}
