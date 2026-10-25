import { useSyncExternalStore } from 'react';

/** Larguras mínimas dos breakpoints do Tailwind. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024 } as const;

/** Sem `matchMedia` (testes/SSR) assume desktop: consultas de largura mínima e ponteiro fino valem. */
function getSnapshot(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(query).matches;
}

function subscribe(query: string, onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const list = window.matchMedia(query);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => getSnapshot(query),
    () => true,
  );
}

/** `true` quando a tela tem pelo menos a largura do breakpoint (ex.: `useBreakpoint('lg')` = desktop). */
export function useBreakpoint(name: keyof typeof BREAKPOINTS): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[name]}px)`);
}

/** Ponteiro preciso (mouse): só aí vale abrir o teclado/foco automático. */
export function useFinePointer(): boolean {
  return useMediaQuery('(pointer: fine)');
}
