import { useNavigate, useParams } from "react-router-dom";

import { VariantForm, type VariantFormData } from "../components/VariantForm";

import { useVariant } from "../hooks/useVariant";
import { useUpdateVariant } from "../hooks/useUpdateVariant";

export function VariantEditPage() {
  const { variantId } = useParams();

  const navigate = useNavigate();

  const { data: variant, isLoading, isError } = useVariant(variantId!);

  const updateVariant = useUpdateVariant(variantId!);

  async function handleSubmit(data: VariantFormData) {
    if (!variant) return;

    await updateVariant.mutateAsync(data);

    navigate(`/products/${variant.productId}`);
  }

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (isError || !variant) {
    return <div>Erro ao carregar variante.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <VariantForm
        title="Editar Variante"
        submitLabel="Salvar Alterações"
        initialValues={{
          name: variant.name,
          barcode: variant.barcode ?? "",
        }}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/products/${variant.productId}`)}
      />
    </div>
  );
}
