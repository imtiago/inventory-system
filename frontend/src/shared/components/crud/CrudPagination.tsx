// src/shared/components/crud/CrudPagination.tsx

import { useBreakpoint } from "@/shared/hooks/useMediaQuery";

/** Botões com cor própria; desabilitado fica legível (sem opacidade) e claramente inativo. */
const navButton =
  "rounded-lg border border-input bg-surface text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-subtle";

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
    const arrow = `min-h-11 min-w-11 text-lg ${navButton}`;
    return (
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <button onClick={onPrevious} disabled={page === 1} aria-label="Página anterior" className={arrow}>
          ‹
        </button>
        <span className="text-sm text-muted">
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
        border-border
        px-4
        py-3
        flex
        flex-wrap
        gap-3
        justify-between
        items-center
      "
    >
      <span className="text-sm text-muted">Total: {totalItems}</span>

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-muted">
          Página {page} de {totalPages}
        </span>

        <button
          onClick={onPrevious}
          disabled={page === 1}
className={`px-3 py-1 ${navButton}`}
        >
          Anterior
        </button>

        <button
          onClick={onNext}
          disabled={page >= totalPages}
className={`px-3 py-1 ${navButton}`}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
