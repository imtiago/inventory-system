// src/shared/components/crud/CrudHeader.tsx

import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

interface CrudHeaderProps {
  title: string;

  description?: string;

  createPath?: string;

  createLabel?: string;

  loading?: boolean;
}

export function CrudHeader({
  title,
  description,
  createPath,
  createLabel,
  loading = false,
}: CrudHeaderProps) {
  return (
    <div
      className="
        flex
        justify-between
        items-center
      "
    >
      <div>
        <h1 className="text-2xl font-bold">
          {title}

          {loading && (
            <span className="ml-2 text-sm text-gray-400">Atualizando...</span>
          )}
        </h1>

        {description && <p className="text-gray-500 mt-1">{description}</p>}
      </div>

      {createPath && (
        <Link
          to={createPath}
          className="
            bg-black
            text-white
            px-4
            py-2
            rounded-lg
            flex
            items-center
            gap-2
            hover:bg-gray-800
            transition
          "
        >
          <Plus size={18} />

          {createLabel ?? "Novo"}
        </Link>
      )}
    </div>
  );
}
