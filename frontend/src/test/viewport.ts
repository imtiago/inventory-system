import { act } from '@testing-library/react';

/**
 * Helper único de breakpoints para testes. jsdom não tem `matchMedia`; sem chamar
 * `setViewport`, o código sob teste vê um desktop (sem matchMedia, o hook assume desktop).
 *
 * Suporta `(min-width: Npx)`, `(max-width: Npx)` e `(pointer: fine|coarse)`, combinados com `and`.
 */
type Listener = (event: MediaQueryListEvent) => void;

interface ViewportState {
  width: number;
  pointer: 'fine' | 'coarse';
}

let state: ViewportState = { width: 1280, pointer: 'fine' };
const registry = new Set<{ query: string; matches: boolean; listeners: Set<Listener> }>();
const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');

function evaluate(query: string): boolean {
  return query
    .split(/\s+and\s+/i)
    .map((part) => part.trim().replace(/^\(|\)$/g, ''))
    .every((part) => {
      const [name, rawValue] = part.split(':').map((s) => s.trim());
      if (name === 'min-width') return state.width >= parseFloat(rawValue);
      if (name === 'max-width') return state.width <= parseFloat(rawValue);
      if (name === 'pointer') return state.pointer === rawValue;
      return false;
    });
}

function install() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => {
      const entry = { query, matches: evaluate(query), listeners: new Set<Listener>() };
      registry.add(entry);
      return {
        get matches() {
          return entry.matches;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, listener: Listener) => entry.listeners.add(listener),
        removeEventListener: (_: string, listener: Listener) => entry.listeners.delete(listener),
        addListener: (listener: Listener) => entry.listeners.add(listener),
        removeListener: (listener: Listener) => entry.listeners.delete(listener),
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
    },
  });
}

/** Simula a largura da tela (e o tipo de ponteiro); notifica quem já estava escutando. */
export function setViewport(width: number, { pointer = 'fine' }: { pointer?: 'fine' | 'coarse' } = {}) {
  state = { width, pointer };
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  if (!window.matchMedia || !registry.size) install();
  act(() => {
    registry.forEach((entry) => {
      const matches = evaluate(entry.query);
      if (matches !== entry.matches) {
        entry.matches = matches;
        entry.listeners.forEach((listener) => listener({ matches, media: entry.query } as MediaQueryListEvent));
      }
    });
  });
}

export const VIEWPORTS = { phone: 375, tablet: 768, laptop: 1024, desktop: 1280 } as const;

/** Volta ao estado "sem matchMedia" (desktop). Chamado no afterEach do setup. */
export function resetViewport() {
  state = { width: 1280, pointer: 'fine' };
  registry.clear();
  if (original) Object.defineProperty(window, 'matchMedia', original);
  else delete (window as { matchMedia?: unknown }).matchMedia;
}
