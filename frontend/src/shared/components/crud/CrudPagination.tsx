// src/shared/components/crud/CrudPagination.tsx

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
  return (
    <div
      className="
        border-t
        px-4
        py-3
        flex
        justify-between
        items-center
      "
    >
      <span className="text-sm text-gray-500">Total: {totalItems}</span>

      <div className="flex items-center gap-4">
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
