import { useId, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

import { useBreakpoint } from "@/shared/hooks/useMediaQuery";

interface FilterPanelProps {
  /** Quantos filtros estão com valor; aparece no botão quando o painel está recolhido. */
  activeCount?: number;
  children: ReactNode;
}

/** Filtros sempre visíveis a partir de `md`; abaixo disso ficam atrás do botão "Filtros". */
export function FilterPanel({ activeCount = 0, children }: FilterPanelProps) {
  const isMd = useBreakpoint("md");
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (isMd) return <>{children}</>;

  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700"
      >
        <SlidersHorizontal size={18} />
        {activeCount > 0 ? `Filtros (${activeCount})` : "Filtros"}
      </button>

      {/* Sempre montado: o estado interno dos campos (autocomplete) não se perde ao recolher. */}
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
