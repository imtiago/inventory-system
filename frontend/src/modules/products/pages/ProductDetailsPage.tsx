import { useState } from "react";
import { useParams, Link } from "react-router-dom";

import { Pencil, Plus, Package, Layers, History } from "lucide-react";

import { DataTable } from "@/shared/components/table";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

import { useProductDetails } from "../hooks/useProductDetails";
import { useDeleteVariant } from "../hooks/useDeleteVariant";

import { useProductVariantColumns } from "../components/ProductVariantColumns";

import type { Variant } from "../services/variantService";

import { Page } from "@/shared/components/layout/Page";
import { PageHeader } from "@/shared/components/layout/PageHeader";

import { Section } from "@/shared/components/details/Section";
import { DetailsGrid } from "@/shared/components/details/DetailsGrid";
import { InfoItem } from "@/shared/components/details/InfoItem";

import { SummaryCard } from "@/shared/components/cards/SummaryCard";

import { CrudPagination } from "@/shared/components/crud";

export function ProductDetailsPage() {
  const [page, setPage] = useState(1);

  const { id } = useParams();

  const [variantToDelete, setVariantToDelete] = useState<Variant | null>(null);

  const {
    product,
    variants: variantsResponse,
    isLoading,
    isError,
  } = useProductDetails(id!);

  const variants = variantsResponse?.data ?? [];

  const pagination = variantsResponse?.pagination;

  const deleteVariant = useDeleteVariant(id!);

  const columns = useProductVariantColumns({
    onDelete: setVariantToDelete,
  });

  if (isLoading) {
    return <div>Carregando produto...</div>;
  }

  if (isError || !product) {
    return <div>Erro ao carregar produto</div>;
  }

  async function handleDelete() {
    if (!variantToDelete) {
      return;
    }

    await deleteVariant.mutateAsync(variantToDelete.id);

    setVariantToDelete(null);
  }

  return (
    <Page>
      <div
        className="
        flex
        flex-col
        gap-6
        h-full
        min-h-0
      "
      >
        <PageHeader
          title={product.name}
          description={product.description ?? "Sem descrição"}
          backPath="/products"
        />

        <Section
          title="Informações do Produto"
          description="Dados gerais do produto"
          className="shrink-0"
        >
          <div className="p-6">
            <DetailsGrid>
              <InfoItem label="Código" value={product.code} />

              <InfoItem label="Marca" value={product.brand.name} />

              <InfoItem label="Categoria" value={product.category.name} />

              <InfoItem label="Variantes" value={variants.length} />
            </DetailsGrid>
          </div>
        </Section>

        <div
          className="
            grid
            grid-cols-3
            gap-6
            shrink-0
          "
        >
          <SummaryCard
            title="Variantes"
            value={variants.length}
            icon={<Layers size={22} />}
          />

          <SummaryCard
            title="Estoque atual"
            value="--"
            icon={<Package size={22} />}
          />

          <SummaryCard
            title="Movimentações"
            value="--"
            icon={<History size={22} />}
          />
        </div>

        <Section
          className="
    flex-1
    min-h-0
  "
          title={`Variantes (${pagination?.totalItems ?? 0})`}
          description="Unidades comercializadas deste produto"
          actions={
            <Link
              to={`/products/${product.id}/variants/new`}
              className="
        bg-black
        text-white
        px-4
        py-2
        rounded-lg
        flex
        items-center
        gap-2
      "
            >
              <Plus size={18} />
              Nova Variante
            </Link>
          }
        >
          <div
            className="
      flex
      flex-col
      flex-1
      min-h-0
    "
          >
            <div
              className="
        flex-1
        overflow-y-auto
      "
            >
              <DataTable
                data={variants}
                columns={columns}
                getRowId={(variant) => variant.id}
              />
            </div>

            <div
              className="
        border-t
        shrink-0
      "
            >
              <CrudPagination
                page={pagination?.page ?? 1}
                totalPages={pagination?.totalPages ?? 1}
                totalItems={pagination?.totalItems ?? 0}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() =>
                  setPage((p) => Math.min(pagination?.totalPages ?? 1, p + 1))
                }
              />
            </div>
          </div>
        </Section>
      </div>

      <ConfirmDialog
        open={!!variantToDelete}
        title="
          Excluir variante
        "
        description={`Deseja realmente excluir a variante "${variantToDelete?.name}"?`}
        loading={deleteVariant.isPending}
        onCancel={() => setVariantToDelete(null)}
        onConfirm={handleDelete}
      />
    </Page>
  );
}
