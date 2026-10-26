import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Download } from 'lucide-react';

import { useBreakpoint } from '@/shared/hooks/useMediaQuery';

/**
 * Agrupa as exportações do cabeçalho: lado a lado a partir de `sm`; abaixo disso, num único botão
 * "Exportar" que abre a lista (assim a ação principal da página cabe na tela sem rolagem horizontal).
 * Os filhos ficam montados mesmo com o menu fechado, para manter o estado de "Exportando..." e dos erros.
 */
export function ExportMenu({ children }: { children: ReactNode }) {
  const isWide = useBreakpoint('sm');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (isWide) return <div className="flex items-start gap-3">{children}</div>;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        <Download size={16} aria-hidden="true" />
        Exportar
        <ChevronDown size={16} aria-hidden="true" className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      <div
        hidden={!open}
        className={`${open ? 'flex' : 'hidden'} absolute left-0 top-full z-30 mt-1 w-56 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg [&_button]:min-h-11 [&_button]:w-full [&_button]:justify-start [&_button]:border-0 [&_div]:w-full`}
      >
        {children}
      </div>
    </div>
  );
}
