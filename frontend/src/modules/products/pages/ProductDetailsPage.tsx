import { useParams, Link } from "react-router-dom";

import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useProductDetails } from "../hooks/useProductDetails";
import { useDeleteVariant } from "../hooks/useDeleteVariant";
import { useState } from "react";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { Variant } from "../services/variantService";

export function ProductDetailsPage() {
  const { id } = useParams();

  const [variantToDelete, setVariantToDelete] = useState<Variant | null>(null);
  const { product, variants, isLoading, isError } = useProductDetails(id!);

  const deleteVariant = useDeleteVariant(id!);

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
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>

          <tbody>
            {variants.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
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
                  <td className="p-3">
                    <div className="flex justify-center gap-3">
                      <Link
                        to={`/variants/${variant.id}/edit`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Pencil size={18} />
                      </Link>

                      <button
                        onClick={() => setVariantToDelete(variant)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!variantToDelete}
        title="Excluir variante"
        description={`Deseja realmente excluir a variante "${variantToDelete?.name}"? Esta ação não poderá ser desfeita.`}
        loading={deleteVariant.isPending}
        onCancel={() => setVariantToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
