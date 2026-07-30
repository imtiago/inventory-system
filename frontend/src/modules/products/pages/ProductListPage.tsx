import { useState } from "react";

import { CrudHeader, CrudPagination } from "@/shared/components/crud";

import { DataTable } from "@/shared/components/table";

import { useProducts } from "../hooks/useProducts";
import { useProductColumns } from "../hooks/useProductColumns";
import { Section } from "@/shared/components/details/Section";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Page } from "@/shared/components/layout/Page";

export function ProductListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useProducts(page);

  const columns = useProductColumns();

  return (
    <Page>
      {/* <CrudHeader
        title="Produtos"
        description="Gerencie seu catálogo"
        createPath="/products/new"
        createLabel="Novo Produto"
        loading={isFetching}
      /> */}

      <Section
        title={`Produtos (${data?.data.length})`}
        description="Unidades comercializadas deste produto"
        actions={
          <Link
            to={`/products/new`}
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
            Novo Produto
          </Link>
        }
      >
        {" "}
        {/* Área da tabela */}
        <div className="flex-1 overflow-y-auto">
          <DataTable
            data={data?.data ?? []}
            columns={columns}
            getRowId={(product) => product.id}
          />
        </div>
        {/* Paginação fixa */}
        <CrudPagination
          page={data?.pagination.page ?? 1}
          totalPages={data?.pagination.totalPages ?? 1}
          totalItems={data?.pagination.total ?? 0}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() =>
            setPage((p) => Math.min(data?.pagination.totalPages ?? 1, p + 1))
          }
        />
      </Section>
    </Page>
  );
}
