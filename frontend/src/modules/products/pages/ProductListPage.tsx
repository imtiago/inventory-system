import { Link } from "react-router-dom";
import { useState } from "react";

import { Plus, Pencil, Trash2 } from "lucide-react";

import { useProducts } from "../hooks/useProducts";

export function ProductListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, isFetching } = useProducts(page);

  if (isLoading) {
    return <div>Carregando produtos...</div>;
  }

  if (error) {
    return <div>Erro ao carregar produtos</div>;
  }

  const products = data?.data ?? [];

  return (
    <div
      className="
        h-full
        flex
        flex-col
        gap-6
      "
    >
      {/* Header */}

      <div
        className="
          flex
          justify-between
          items-center
        "
      >
        <div>
          <h1 className="text-2xl font-bold">
            Produtos
            {isFetching && (
              <span
                className="
                    text-sm
                    text-gray-400
                    ml-2
                  "
              >
                Atualizando...
              </span>
            )}
          </h1>

          <p className="text-gray-500">Gerencie seu catálogo</p>
        </div>

        <Link
          to="/products/new"
          className="
            bg-black
            text-white
            px-4
            py-2
            rounded-lg
            flex
            gap-2
          "
        >
          <Plus size={18} />
          Novo Produto
        </Link>
      </div>

      {/* Tabela + Paginação */}

      <div
        className="
          bg-white
          rounded-xl
          shadow
          flex-1
          min-h-0
          flex
          flex-col
          overflow-hidden
        "
      >
        {/* Área com scroll */}

        <div
          className="
            overflow-y-auto
            flex-1
            min-h-0
          "
        >
          <table className="w-full">
            <thead
              className="
                bg-gray-100
                sticky
                top-0
                z-10
              "
            >
              <tr>
                <th className="p-4 text-left">Código</th>

                <th className="p-4 text-left">Produto</th>

                <th className="p-4 text-left">Marca</th>

                <th className="p-4 text-left">Categoria</th>

                <th className="p-4 text-left">Variantes</th>

                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="
                      border-t
                      hover:bg-gray-50
                    "
                >
                  <td className="p-4">{product.code}</td>

                  <td className="p-4">
                    <Link
                      to={`/products/${product.id}`}
                      className="
                          font-medium
                          hover:underline
                        "
                    >
                      {product.name}
                    </Link>

                    <div
                      className="
                          text-sm
                          text-gray-500
                        "
                    >
                      {product.description}
                    </div>
                  </td>

                  <td className="p-4">{product.brand.name}</td>

                  <td className="p-4">{product.category.name}</td>

                  <td className="p-4">
                    <span
                      className="
                          bg-blue-100
                          text-blue-700
                          px-3
                          py-1
                          rounded-full
                          text-sm
                        "
                    >
                      {product.variantsCount}
                    </span>
                  </td>

                  <td
                    className="
                        p-4
                        flex
                        justify-center
                        gap-3
                      "
                  >
                    <Link
                      to={`/products/${product.id}/edit`}
                      className="text-blue-600"
                    >
                      <Pencil size={18} />
                    </Link>

                    <button className="text-red-600">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação fixa */}

        <div
          className="
            border-t
            flex
            justify-between
            items-center
            px-4
            py-3
          "
        >
          <span
            className="
              text-sm
              text-gray-500
            "
          >
            Total: {data?.pagination.totalItems} produtos
          </span>

          <div
            className="
              flex
              items-center
              gap-4
            "
          >
            <span
              className="
                text-sm
                text-gray-500
              "
            >
              Página {data?.pagination.page} de {data?.pagination.totalPages}
            </span>

            <button
              disabled={page === 1}
              onClick={() => setPage((old) => old - 1)}
              className="
                px-3
                py-1
                border
                rounded
                disabled:opacity-50
              "
            >
              Anterior
            </button>

            <button
              disabled={page === data?.pagination.totalPages}
              onClick={() => setPage((old) => old + 1)}
              className="
                px-3
                py-1
                border
                rounded
                disabled:opacity-50
              "
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
