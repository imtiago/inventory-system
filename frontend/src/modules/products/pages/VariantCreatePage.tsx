import { useNavigate, useParams } from "react-router-dom";

import { Page } from "@/shared/components/layout/Page";
import { VariantForm, type VariantFormData } from "../components/VariantForm";

import { useApplyTargetMargin } from "@/modules/pricing/hooks/usePricingMutations";
import { useCreateVariant } from "../hooks/useCreateVariant";

export function VariantCreatePage() {
  const { id } = useParams();

  const navigate = useNavigate();

  const createVariant = useCreateVariant(id!);
  const applyMargin = useApplyTargetMargin();

  async function handleSubmit(data: VariantFormData) {
    const variant = await createVariant.mutateAsync(data);

    await applyMargin("variant", variant.id, data.targetMarginBps);

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
