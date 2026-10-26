import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

import { Pencil, Plus, Trash2 } from "lucide-react";

import { DataTable } from "@/shared/components/table";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

import { useProduct } from "../hooks/useProduct";
import { useProductVariants } from "../hooks/useProductVariants";
import { useDeleteProduct } from "../hooks/useDeleteProduct";
import { useInventoryBalances } from "@/modules/inventory/hooks/useInventoryBalances";
import { useDeleteVariant } from "../hooks/useDeleteVariant";

import { useProductVariantColumns } from "../components/ProductVariantColumns";

import type { Variant } from "../services/variantService";

import { Page } from "@/shared/components/layout/Page";
import { PageHeader } from "@/shared/components/layout/PageHeader";

import { Section } from "@/shared/components/details/Section";
import { DetailsGrid } from "@/shared/components/details/DetailsGrid";
import { InfoItem } from "@/shared/components/details/InfoItem";

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

  const stock = useInventoryBalances(variants.map((variant) => variant.id));

  const columns = useProductVariantColumns({
    onDelete: setVariantToDelete,
    stock,
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
    <Page width="narrow">
      <PageHeader
        title={product.name}
        description={product.description ?? "Sem descrição"}
        backPath="/products"
        backLabel="produtos"
        actions={
          <>
            <Can permission="catalog.write">
              <Link
                to={`/products/${product.id}/edit`}
                className="flex items-center gap-2 rounded-lg border border-input bg-surface text-foreground px-4 py-2 hover:bg-surface-muted"
              >
                <Pencil size={18} />
                Editar
              </Link>
            </Can>

            <Can permission="catalog.delete">
              <button
                type="button"
                onClick={() => setConfirmDeleteProduct(true)}
                className="flex items-center gap-2 rounded-lg border border-danger/30 px-4 py-2 text-danger hover:bg-danger-soft"
              >
                <Trash2 size={18} />
                Excluir
              </button>
            </Can>
          </>
        }
      />

      <Section title="Informações do Produto" description="Dados gerais do produto">
        <div className="p-4 sm:p-6">
          <DetailsGrid>
            <InfoItem label="Código" value={product.code} />

            <InfoItem label="Marca" value={product.brand.name} />

            <InfoItem label="Categoria" value={product.category.name} />

            <InfoItem label="Variantes" value={product.variantsCount} />
          </DetailsGrid>
        </div>
      </Section>

      <Section
        title={variantsError && !variantsResponse ? "Variantes" : `Variantes (${pagination?.total ?? 0})`}
        description="Unidades comercializadas deste produto"
        actions={
          <Can permission="catalog.write">
            <Link
              to={`/products/${product.id}/variants/new`}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover"
            >
              <Plus size={18} />
              Nova Variante
            </Link>
          </Can>
        }
      >
        {variantsError && !variantsResponse ? (
          <div role="alert" className="flex min-h-32 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-medium text-danger">Não foi possível carregar as variantes.</p>
            <button type="button" onClick={() => void refetchVariants()} className="rounded-lg border border-input bg-surface text-foreground px-4 py-2 hover:bg-surface-muted">
              Tentar novamente
            </button>
          </div>
        ) : variantsLoading ? (
          <div className="p-6 text-center text-sm text-muted">Carregando variantes...</div>
        ) : (
          <DataTable
            data={variants}
            emptyMessage="Nenhuma variante cadastrada"
            emptyHint="Cadastre uma variante para vender este produto."
            columns={columns}
            getRowId={(variant) => variant.id}
          />
        )}

        <div className="border-t border-border">
          <CrudPagination
            page={pagination?.page ?? 1}
            totalPages={pagination?.totalPages ?? 1}
            totalItems={pagination?.total ?? 0}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pagination?.totalPages ?? 1, p + 1))}
          />
        </div>
      </Section>

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
