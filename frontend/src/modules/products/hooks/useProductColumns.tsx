// src/modules/products/hooks/useProductColumns.tsx

import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumn } from "@/shared/components/table";
import { CrudBadge } from "@/shared/components/crud";

import type { Product } from "../types";
import { Can } from "@/shared/auth/Can";

interface Props {
  onDelete(product: Product): void;
}

export function useProductColumns({ onDelete }: Props): DataTableColumn<Product>[] {
  return [
    {
      id: "code",
      header: "Código",
      mobile: "meta",

      cell: (product) => product.code,
    },

    {
      id: "name",
      header: "Produto",
      mobile: "title",

      cell: (product) => (
        <div>
          <Link
            to={`/products/${product.id}`}
            className="font-medium hover:underline"
          >
            {product.name}
          </Link>

          <div className="text-sm text-gray-500">
            {product.description ?? ""}
          </div>
        </div>
      ),
    },

    {
      id: "brand",
      header: "Marca",
      mobile: "meta",

      cell: (product) => product.brand.name,
    },

    {
      id: "category",
      header: "Categoria",
      mobile: "meta",

      cell: (product) => product.category.name,
    },

    {
      id: "variants",
      header: "Variantes",
      mobile: "meta",
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
      mobile: "actions",
      align: "center",

      cell: (product) => (
        <div className="flex justify-center gap-1">
          <Can permission="catalog.write">
            <Link
              to={`/products/${product.id}/edit`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-blue-600 hover:text-blue-800"
              aria-label={`Editar ${product.name}`}
            >
              <Pencil size={18} />
            </Link>
          </Can>

          <Can permission="catalog.delete">
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-red-600 hover:text-red-800"
              onClick={() => onDelete(product)}
              aria-label={`Excluir ${product.name}`}
            >
              <Trash2 size={18} />
            </button>
          </Can>
        </div>
      ),
    },
  ];
}