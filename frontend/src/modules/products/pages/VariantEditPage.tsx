import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Page } from "@/shared/components/layout/Page";
import { VariantForm, type VariantFormData } from "../components/VariantForm";

import { percentToBps } from "@/modules/pricing/utils/targetMargin";
import { useApplyTargetMargin } from "@/modules/pricing/hooks/usePricingMutations";
import { useVariant } from "../hooks/useVariant";
import type { SaveVariantDTO } from "../services/variantService";
import { useUpdateVariant } from "../hooks/useUpdateVariant";
import { LoadingState } from "@/shared/components/LoadingState";
import { useCan } from "@/shared/auth/useCan";
import { VariantPricingPanel } from "@/modules/pricing/components/VariantPricingPanel";

export function VariantEditPage() {
  const { variantId } = useParams();

  const navigate = useNavigate();

  // The form only takes its defaults on mount, so it must start from data fetched after this page opened
  // (a cached copy from before an edit would be sent back and revert the price).
  const [openedAt] = useState(() => Date.now());

  const { data: variant, isLoading, isError, dataUpdatedAt } = useVariant(variantId!);

  const updateVariant = useUpdateVariant(variantId!, variant?.productId ?? "");
  const applyMargin = useApplyTargetMargin();
  const canPrice = useCan("catalog.price");

  async function handleSubmit(data: VariantFormData) {
    if (!variant) return;

    // Só os campos alterados: reenviar o formulário inteiro reverteria edições concorrentes
    // de outros usuários nos campos que esta pessoa nem tocou (e o preço exige permissão).
    const { targetMarginBps } = data;
    const changes: Partial<SaveVariantDTO> = {};
    if (data.name !== variant.name) changes.name = data.name;
    if ((data.barcode ?? null) !== (variant.barcode ?? null)) changes.barcode = data.barcode ?? null;
    if (data.salePrice !== undefined && data.salePrice !== variant.salePrice) changes.salePrice = data.salePrice;

    if (Object.keys(changes).length > 0) await updateVariant.mutateAsync(changes);

    await applyMargin("variant", variant.id, targetMarginBps);

    navigate(`/products/${variant.productId}`);
  }

  if (isLoading || (variant && !isError && dataUpdatedAt < openedAt)) {
    return <LoadingState label="Carregando..." />;
  }

  if (isError || !variant) {
    return <div>Erro ao carregar variante.</div>;
  }

  return (
    <Page width="narrow">
      {/* O preço muda por fora (aplicar sugerido/revista): recria o formulário para não reenviar o preço antigo. */}
      <VariantForm
        key={variant.salePrice}
        title="Editar Variante"
        submitLabel="Salvar Alterações"
        requireSalePrice
        initialValues={{
          name: variant.name,
          barcode: variant.barcode ?? "",
          salePrice: variant.salePrice,
          targetMarginBps: percentToBps(variant.targetMarginPercent),
        }}
        onSubmit={handleSubmit}
        backPath={`/products/${variant.productId}`}
        backLabel="produto"
        onCancel={() => navigate(`/products/${variant.productId}`)}
      />

      {canPrice && <VariantPricingPanel variantId={variant.id} />}
    </Page>
  );
}
