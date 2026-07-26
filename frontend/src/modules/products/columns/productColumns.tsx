// src/modules/products/columns/productColumns.tsx

import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumn } from "@/shared/components/table";
import type { Product } from "../types";

interface ProductColumnsProps {
  onDelete(product: Product): void;
}

export function productColumns({
  onDelete,
}: ProductColumnsProps): DataTableColumn<Product>[] {
  return [
    {
      id: "code",
      header: "Código",

      cell: (product) => product.code,
    },

    {
      id: "name",
      header: "Produto",

      cell: (product) => (
        <div>
          <Link
            to={`/products/${product.id}`}
            className="font-medium hover:underline"
          >
            {product.name}
          </Link>

          <div className="text-sm text-gray-500">{product.description}</div>
        </div>
      ),
    },

    {
      id: "brand",
      header: "Marca",

      cell: (product) => product.brand.name,
    },

    {
      id: "category",
      header: "Categoria",

      cell: (product) => product.category.name,
    },

    {
      id: "variants",
      header: "Variantes",
      align: "center",

      cell: (product) => (
        <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm">
          {product.variantsCount}
        </span>
      ),
    },

    {
      id: "actions",
      header: "Ações",
      align: "center",

      cell: (product) => (
        <div className="flex justify-center gap-3">
          <Link
            to={`/products/${product.id}/edit`}
            className="text-blue-600 hover:text-blue-800"
          >
            <Pencil size={18} />
          </Link>

          <button
            onClick={() => onDelete(product)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];
}
