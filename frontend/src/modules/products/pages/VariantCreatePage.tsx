import { useNavigate, useParams } from "react-router-dom";

import { Page } from "@/shared/components/layout/Page";
import { VariantForm, type VariantFormData } from "../components/VariantForm";

import { useCreateVariant } from "../hooks/useCreateVariant";

export function VariantCreatePage() {
  const { id } = useParams();

  const navigate = useNavigate();

  const createVariant = useCreateVariant(id!);

  async function handleSubmit(data: VariantFormData) {
    await createVariant.mutateAsync(data);

    navigate(`/products/${id}`);
  }

  return (
    <Page width="narrow">
      <VariantForm
        title="Nova Variante"
        submitLabel="Salvar Variante"
        onSubmit={handleSubmit}
        backPath={`/products/${id}`}
        backLabel="produto"
        onCancel={() => navigate(`/products/${id}`)}
      />
    </Page>
  );
}
