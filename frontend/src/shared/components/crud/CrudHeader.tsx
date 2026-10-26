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
        <h1 className="text-2xl font-semibold text-foreground">
          {title}

          {loading && (
            <span className="ml-2 text-sm font-normal text-subtle">Atualizando...</span>
          )}
        </h1>

        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>

      {createPath && (
        <Link
          to={createPath}
          className="
            bg-primary
            text-primary-foreground
            px-4
            py-2
            rounded-lg
            flex
            items-center
            gap-2
            hover:bg-primary-hover
            transition
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-ring
            focus-visible:ring-offset-2
          "
        >
          <Plus size={18} />

          {createLabel ?? "Novo"}
        </Link>
      )}
    </div>
  );
}
