// src/shared/components/crud/CrudPagination.tsx

import { useBreakpoint } from "@/shared/hooks/useMediaQuery";

interface CrudPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrevious(): void;
  onNext(): void;
}

export function CrudPagination({
  page,
  totalPages,
  totalItems,
  onPrevious,
  onNext,
}: CrudPaginationProps) {
  const isSm = useBreakpoint("sm");

  if (!isSm) {
    // Celular: só setas e a página atual (o total e "de Y" não cabem e raramente ajudam).
    const arrow = "min-h-11 min-w-11 rounded border text-lg disabled:opacity-50";
    return (
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <button onClick={onPrevious} disabled={page === 1} aria-label="Página anterior" className={arrow}>
          ‹
        </button>
        <span className="text-sm text-gray-500">
          {page} / {totalPages}
        </span>
        <button onClick={onNext} disabled={page >= totalPages} aria-label="Próxima página" className={arrow}>
          ›
        </button>
      </div>
    );
  }

  return (
    <div
      className="
        border-t
        px-4
        py-3
        flex
        flex-wrap
        gap-3
        justify-between
        items-center
      "
    >
      <span className="text-sm text-gray-500">Total: {totalItems}</span>

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-gray-500">
          Página {page} de {totalPages}
        </span>

        <button
          onClick={onPrevious}
          disabled={page === 1}
          className="
            border
            rounded
            px-3
            py-1
            disabled:opacity-50
          "
        >
          Anterior
        </button>

        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="
            border
            rounded
            px-3
            py-1
            disabled:opacity-50
          "
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
