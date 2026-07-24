import { useParams, Link } from "react-router-dom";

import { ArrowLeft } from "lucide-react";

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
      <Link
        to="/products"
        className="
          flex
          items-center
          gap-2
          text-gray-600
        "
      >
        <ArrowLeft size={18} />
        Voltar
      </Link>

      {/* Dados do produto */}

      <div
        className="
          bg-white
          rounded-xl
          shadow
          p-6
        "
      >
        <h1 className="text-2xl font-bold">{product.name}</h1>

        <p className="text-gray-500">{product.description}</p>

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

            <p>{product.code}</p>
          </div>

          <div>
            <span className="text-gray-500">Marca</span>

            <p>{product.brand.name}</p>
          </div>

          <div>
            <span className="text-gray-500">Categoria</span>

            <p>{product.category.name}</p>
          </div>
        </div>
      </div>

      {/* Variantes */}

      <div
        className="
          bg-white
          rounded-xl
          shadow
          p-6
        "
      >
        <h2 className="text-xl font-bold mb-4">
          Variantes ({variants.length})
        </h2>

        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Código</th>

              <th className="p-3 text-left">Nome</th>

              <th className="p-3 text-left">Código de barras</th>
            </tr>
          </thead>

          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id} className="border-t">
                <td className="p-3">{variant.code}</td>

                <td className="p-3">{variant.name}</td>

                <td className="p-3">{variant.barcode ?? "Não informado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
