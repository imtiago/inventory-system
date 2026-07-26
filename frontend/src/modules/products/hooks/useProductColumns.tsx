// src/modules/products/hooks/useProductColumns.tsx

import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumn } from "@/shared/components/table";
import { CrudBadge } from "@/shared/components/crud";

import type { Product } from "../types";
import { useDeleteProduct } from "./useDeleteProduct";

export function useProductColumns(): DataTableColumn<Product>[] {
  const deleteProduct = useDeleteProduct();

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

          <div className="text-sm text-gray-500">
            {product.description}
          </div>
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
        <CrudBadge>
          {product.variantsCount}
        </CrudBadge>
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
            className="text-red-600 hover:text-red-800"
            onClick={() => deleteProduct.mutate(product.id)}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];
}