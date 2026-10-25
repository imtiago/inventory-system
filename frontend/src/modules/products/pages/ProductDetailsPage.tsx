import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

import { Pencil, Plus, Layers, Trash2 } from "lucide-react";

import { DataTable } from "@/shared/components/table";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

import { useProduct } from "../hooks/useProduct";
import { useProductVariants } from "../hooks/useProductVariants";
import { useDeleteProduct } from "../hooks/useDeleteProduct";
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
import { Can } from "@/shared/auth/Can";

export function ProductDetailsPage() {
  const [page, setPage] = useState(1);

  const { id } = useParams();

  const navigate = useNavigate();

  const [variantToDelete, setVariantToDelete] = useState<Variant | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(false);

  const deleteProduct = useDeleteProduct();

  // Once the delete starts, the product's own queries must not refetch (they would 404).
  const deleting = deleteProduct.isPending || deleteProduct.isSuccess;

  const { data: product, isLoading, isError } = useProduct(id!, { enabled: !deleting });

  const { data: variantsResponse, isError: variantsError, isLoading: variantsLoading, refetch: refetchVariants } = useProductVariants(id!, page, { enabled: !deleting });

  const variants = variantsResponse?.data ?? [];

  const pagination = variantsResponse?.pagination;

  const deleteVariant = useDeleteVariant(id!);

  const columns = useProductVariantColumns({
    onDelete: setVariantToDelete,
  });

  if (isLoading || deleteProduct.isSuccess) {
    return <div>Carregando produto...</div>;
  }

  if (isError || !product) {
    return <div>Erro ao carregar produto</div>;
  }

  async function handleDelete() {
    if (!variantToDelete) {
      return;
    }

    try {
      await deleteVariant.mutateAsync(variantToDelete.id);

      // Deleting the last item of the last page leaves that page empty.
      if (variants.length === 1 && page > 1) setPage(page - 1);
    } catch {
      // useDeleteVariant already shows the backend message (VARIANT_IN_USE, LAST_VARIANT).
    } finally {
      setVariantToDelete(null);
    }
  }

  async function handleDeleteProduct() {
    try {
      await deleteProduct.mutateAsync(product!.id);

      navigate("/products");
    } catch {
      // useDeleteProduct already shows the backend message (PRODUCT_IN_USE).
    } finally {
      setConfirmDeleteProduct(false);
    }
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
          actions={
            <div className="flex gap-3">
              <Can permission="catalog.write">
                <Link
                  to={`/products/${product.id}/edit`}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2"
                >
                  <Pencil size={18} />
                  Editar
                </Link>
              </Can>

              <Can permission="catalog.delete">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteProduct(true)}
                  className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-red-600"
                >
                  <Trash2 size={18} />
                  Excluir
                </button>
              </Can>
            </div>
          }
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

              <InfoItem label="Variantes" value={product.variantsCount} />
            </DetailsGrid>
          </div>
        </Section>

        <div
          className="
            grid
            grid-cols-1
            gap-6
            shrink-0
          "
        >
          <SummaryCard
            title="Variantes"
            value={product.variantsCount}
            icon={<Layers size={22} />}
          />
        </div>

        <Section
          className="
    flex-1
    min-h-0
  "
          title={variantsError && !variantsResponse ? "Variantes" : `Variantes (${pagination?.total ?? 0})`}
          description="Unidades comercializadas deste produto"
          actions={
            <Can permission="catalog.write">
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
            </Can>
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
              {variantsError && !variantsResponse ? (
                <div role="alert" className="flex min-h-32 flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="font-medium text-red-600">Não foi possível carregar as variantes.</p>
                  <button type="button" onClick={() => void refetchVariants()} className="rounded-lg border px-4 py-2 hover:bg-gray-50">
                    Tentar novamente
                  </button>
                </div>
              ) : variantsLoading ? (
                <div className="p-6 text-center text-sm text-gray-500">Carregando variantes...</div>
              ) : (
                <DataTable
                  data={variants}
                  columns={columns}
                  getRowId={(variant) => variant.id}
                />
              )}
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
                totalItems={pagination?.total ?? 0}
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
        open={confirmDeleteProduct}
        title="Excluir produto"
        description={`Deseja realmente excluir o produto "${product.name}"?`}
        loading={deleteProduct.isPending}
        onCancel={() => setConfirmDeleteProduct(false)}
        onConfirm={handleDeleteProduct}
      />

      <ConfirmDialog
        open={!!variantToDelete}
        title="Excluir variante"
        description={`Deseja realmente excluir a variante "${variantToDelete?.name}"?`}
        loading={deleteVariant.isPending}
        onCancel={() => setVariantToDelete(null)}
        onConfirm={handleDelete}
      />
    </Page>
  );
}
