import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Page } from "@/shared/components/layout/Page";
import { VariantForm, type VariantFormData } from "../components/VariantForm";

import { useVariant } from "../hooks/useVariant";
import type { SaveVariantDTO } from "../services/variantService";
import { useUpdateVariant } from "../hooks/useUpdateVariant";

export function VariantEditPage() {
  const { variantId } = useParams();

  const navigate = useNavigate();

  // The form only takes its defaults on mount, so it must start from data fetched after this page opened
  // (a cached copy from before an edit would be sent back and revert the price).
  const [openedAt] = useState(() => Date.now());

  const { data: variant, isLoading, isError, dataUpdatedAt } = useVariant(variantId!);

  const updateVariant = useUpdateVariant(variantId!, variant?.productId ?? "");

  async function handleSubmit(data: VariantFormData) {
    if (!variant) return;

    // Só os campos alterados: reenviar o formulário inteiro reverteria edições concorrentes
    // de outros usuários nos campos que esta pessoa nem tocou (e o preço exige permissão).
    const changes: Partial<SaveVariantDTO> = {};
    if (data.name !== variant.name) changes.name = data.name;
    if ((data.barcode ?? null) !== (variant.barcode ?? null)) changes.barcode = data.barcode ?? null;
    if (data.salePrice !== undefined && data.salePrice !== variant.salePrice) changes.salePrice = data.salePrice;

    if (Object.keys(changes).length > 0) await updateVariant.mutateAsync(changes);

    navigate(`/products/${variant.productId}`);
  }

  if (isLoading || (variant && !isError && dataUpdatedAt < openedAt)) {
    return <div>Carregando...</div>;
  }

  if (isError || !variant) {
    return <div>Erro ao carregar variante.</div>;
  }

  return (
    <Page width="narrow">
      <VariantForm
        title="Editar Variante"
        submitLabel="Salvar Alterações"
        requireSalePrice
        initialValues={{
          name: variant.name,
          barcode: variant.barcode ?? "",
          salePrice: variant.salePrice,
        }}
        onSubmit={handleSubmit}
        backPath={`/products/${variant.productId}`}
        backLabel="produto"
        onCancel={() => navigate(`/products/${variant.productId}`)}
      />
    </Page>
  );
}
