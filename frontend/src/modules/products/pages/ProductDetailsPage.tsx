import { useParams, Link } from "react-router-dom";

import { ArrowLeft, Plus } from "lucide-react";

import { useProductDetails } from "../hooks/useProductDetails";

export function ProductDetailsPage() {
  const { id } = useParams();

  const { product, variants, isLoading, isError } = useProductDetails(id!);

  if (isLoading) {
    return <div>Carregando produto...</div>;
  }

  if (isError || !product) {
    return <div>Erro ao carregar produto</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}

      <div className="flex justify-between items-center">
        <Link
          to="/products"
          className="
            flex
            items-center
            gap-2
            text-gray-600
            hover:text-black
          "
        >
          <ArrowLeft size={18} />
          Voltar
        </Link>
      </div>

      {/* Dados do produto */}

      <div
        className="
          bg-white
          rounded-xl
          shadow
          p-6
        "
      >
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>

          <p className="text-gray-500">
            {product.description || "Sem descrição"}
          </p>
        </div>

        <div
          className="
            grid
            grid-cols-3
            gap-6
            mt-6
          "
        >
          <div>
            <span className="text-gray-500">Código</span>

            <p className="font-medium">{product.code}</p>
          </div>

          <div>
            <span className="text-gray-500">Marca</span>

            <p className="font-medium">{product.brand.name}</p>
          </div>

          <div>
            <span className="text-gray-500">Categoria</span>

            <p className="font-medium">{product.category.name}</p>
          </div>
        </div>
      </div>

      {/* Variantes */}

      <div
        className="
          bg-white
          rounded-xl
          shadow
          overflow-hidden
        "
      >
        <div
          className="
            flex
            justify-between
            items-center
            p-6
          "
        >
          <div>
            <h2 className="text-xl font-bold">Variantes ({variants.length})</h2>

            <p className="text-gray-500 text-sm">
              Unidades comercializadas deste produto
            </p>
          </div>

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
        </div>

        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Código</th>

              <th className="p-3 text-left">Nome</th>

              <th className="p-3 text-left">Código de barras</th>
            </tr>
          </thead>

          <tbody>
            {variants.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="
                      text-center
                      p-6
                      text-gray-500
                    "
                >
                  Nenhuma variante cadastrada
                </td>
              </tr>
            ) : (
              variants.map((variant) => (
                <tr
                  key={variant.id}
                  className="
                    border-t
                    hover:bg-gray-50
                  "
                >
                  <td className="p-3">{variant.code}</td>

                  <td className="p-3 font-medium">{variant.name}</td>

                  <td className="p-3">{variant.barcode ?? "Não informado"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
