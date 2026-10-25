import { useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, Plus, Search } from "lucide-react";

import { CrudPagination } from "@/shared/components/crud";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { DataTable } from "@/shared/components/table";
import { FilterPanel } from "@/shared/components/layout/FilterPanel";
import { Section } from "@/shared/components/details/Section";
import { Page } from "@/shared/components/layout/Page";
import { Can } from "@/shared/auth/Can";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

import { EntitySearchSelect } from "@/shared/components/form/EntitySearchSelect";
import { useBrands } from "@/modules/brands/hooks/useBrands";
import { useCategories } from "@/modules/categories/hooks/useCategories";

import { useProducts } from "../hooks/useProducts";
import { useDeleteProduct } from "../hooks/useDeleteProduct";
import { useProductColumns } from "../hooks/useProductColumns";
import type { Product } from "../types";

const PAGE_SIZE = 10;

export function ProductListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isFetching, isError } = useProducts({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch,
    brandId,
    categoryId,
  });


  const deleteProduct = useDeleteProduct();

  const columns = useProductColumns({ onDelete: setProductToDelete });

  const pagination = data?.pagination;

  async function handleDelete() {
    if (!productToDelete) return;

    try {
      await deleteProduct.mutateAsync(productToDelete.id);

      // Deleting the last item of the last page leaves that page empty.
      if (page > 1 && (data?.data.length ?? 0) === 1) setPage(page - 1);
    } catch {
      // useDeleteProduct already shows the backend message.
    } finally {
      setProductToDelete(null);
    }
  }

  return (
    <Page>
      <Section
        title={pagination ? `Produtos (${pagination.total})` : "Produtos"}
        description="Gerencie seu catálogo"
        actions={
          <Can permission="catalog.write">
            <Link to="/products/new" className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white">
              <Plus size={18} />
              Novo Produto
            </Link>
          </Can>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-gray-100 p-3 sm:p-5">
          <FilterPanel activeCount={[search, brandId, categoryId].filter(Boolean).length}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                maxLength={120}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nome, código ou código de barras..."
                aria-label="Buscar produtos"
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 outline-none focus:border-gray-400"
              />
            </div>

            <div className="w-full sm:w-56">
              <EntitySearchSelect
                useOptions={useBrands}
                ariaLabel="Filtrar por marca"
                placeholder="Todas as marcas"
                value={brandId}
                onChange={(id) => {
                  setBrandId(id);
                  setPage(1);
                }}
              />
            </div>

            <div className="w-full sm:w-56">
              <EntitySearchSelect
                useOptions={useCategories}
                ariaLabel="Filtrar por categoria"
                placeholder="Todas as categorias"
                value={categoryId}
                onChange={(id) => {
                  setCategoryId(id);
                  setPage(1);
                }}
              />
            </div>
          </div>
          </FilterPanel>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isError ? (
              <div className="p-6 text-center font-medium text-red-600">Não foi possível carregar os produtos.</div>
            ) : isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500">
                <LoaderCircle size={20} className="animate-spin" />
                Carregando produtos...
              </div>
            ) : (
              <DataTable data={data?.data ?? []} columns={columns} getRowId={(product) => product.id} getRowHref={(product) => `/products/${product.id}`} />
            )}
          </div>

          {isFetching && !isLoading && (
            <div className="border-t border-gray-100 px-5 py-2 text-xs text-gray-500">Atualizando resultados...</div>
          )}

          <CrudPagination
            page={pagination?.page ?? page}
            totalPages={pagination?.totalPages ?? 1}
            totalItems={pagination?.total ?? 0}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(pagination?.totalPages ?? 1, current + 1))}
          />
        </div>
      </Section>

      <ConfirmDialog
        open={!!productToDelete}
        title="Excluir produto"
        description={`Deseja realmente excluir o produto "${productToDelete?.name}"?`}
        loading={deleteProduct.isPending}
        onCancel={() => setProductToDelete(null)}
        onConfirm={handleDelete}
      />
    </Page>
  );
}
