import { Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { DataTableColumn } from "@/shared/components/table";

import { formatCurrency } from "@/shared/utils/money";

import { VariantStock } from "./VariantStock";

import type { Variant } from "../services/variantService";
import type { InventoryBalance } from "@/modules/inventory/services/inventoryService";
import { Can } from "@/shared/auth/Can";

interface Props {
  onDelete(variant: Variant): void;
  /** Stock of the variants on the page, fetched once for all rows. */
  stock: { balances: Map<string, InventoryBalance>; loading: boolean; error: boolean };
}

export function useProductVariantColumns({
  onDelete,
  stock,
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
      id: "salePrice",
      header: "Preço de venda",

      cell: (variant) => formatCurrency(variant.salePrice),
    },

    {
      id: "stock",
      header: "Estoque",

      cell: (variant) => <VariantStock balance={stock.balances.get(variant.id)} loading={stock.loading} error={stock.error} />,
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

          <Can permission="catalog.delete">
            <button
              onClick={() => onDelete(variant)}
              className="
              text-red-600
              hover:text-red-800
            "
            >
              <Trash2 size={18} />
            </button>
          </Can>
        </div>
      ),
    },
  ];
}
