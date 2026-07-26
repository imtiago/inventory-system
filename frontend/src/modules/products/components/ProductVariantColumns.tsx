import { Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { DataTableColumn } from "@/shared/components/table";

import { VariantStock } from "./VariantStock";

import type { Variant } from "../services/variantService";

interface Props {
  onDelete(variant: Variant): void;
}

export function useProductVariantColumns({
  onDelete,
}: Props): DataTableColumn<Variant>[] {
  return [
    {
      id: "code",
      header: "Código",

      cell: (variant) => variant.code,
    },

    {
      id: "name",
      header: "Nome",

      cell: (variant) => <span className="font-medium">{variant.name}</span>,
    },

    {
      id: "barcode",
      header: "Código de barras",

      cell: (variant) => variant.barcode ?? "Não informado",
    },

    {
      id: "stock",
      header: "Estoque",

      cell: (variant) => <VariantStock variantId={variant.id} />,
    },

    {
      id: "actions",
      header: "Ações",
      align: "center",

      cell: (variant) => (
        <div className="flex justify-center gap-3">
          <Link
            to={`/variants/${variant.id}/edit`}
            className="
              text-blue-600
              hover:text-blue-800
            "
          >
            <Pencil size={18} />
          </Link>

          <button
            onClick={() => onDelete(variant)}
            className="
              text-red-600
              hover:text-red-800
            "
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];
}
