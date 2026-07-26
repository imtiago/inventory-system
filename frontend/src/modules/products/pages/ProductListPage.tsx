import { useState } from "react";

import { CrudHeader, CrudPage, CrudPagination } from "@/shared/components/crud";

import { DataTable } from "@/shared/components/table";

import { useProducts } from "../hooks/useProducts";
import { useProductColumns } from "../hooks/useProductColumns";

export function ProductListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useProducts(page);

  const columns = useProductColumns();

  return (
    <CrudPage>
      <CrudHeader
        title="Produtos"
        description="Gerencie seu catálogo"
        createPath="/products/new"
        createLabel="Novo Produto"
        loading={isFetching}
      />

      <div
        className="
          bg-white
          rounded-xl
          shadow
          flex-1
          overflow-hidden
        "
      >
        <DataTable
          data={data?.data ?? []}
          columns={columns}
          getRowId={(product) => product.id}
        />
      </div>

      <CrudPagination
        page={data?.pagination.page ?? 1}
        totalPages={data?.pagination.totalPages ?? 1}
        totalItems={data?.pagination.totalItems ?? 0}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() =>
          setPage((p) => Math.min(data?.pagination.totalPages ?? 1, p + 1))
        }
      />
    </CrudPage>
  );
}
