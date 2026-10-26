import { create } from 'zustand';

import {
  DARK_QUERY,
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  readStoredPreference,
  resolveTheme,
  safeStorage,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemePreference,
} from '@/shared/theme/theme';

type ThemeState = {
  /** O que o usuário escolheu (padrão: seguir o sistema). */
  preference: ThemePreference;
  /** O tema efetivamente aplicado. */
  resolved: ResolvedTheme;
  /** Aplica e grava em localStorage['ui.theme'] (preferência por navegador). */
  setPreference: (preference: ThemePreference) => void;
};

function apply(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark());
  applyTheme(resolved);
  return resolved;
}

const initial = readStoredPreference(safeStorage());

export const useThemeStore = create<ThemeState>((set) => ({
  preference: initial,
  resolved: resolveTheme(initial, systemPrefersDark()),

  setPreference: (preference) => {
    try {
      safeStorage()?.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage bloqueado ou cheio: o tema vale só nesta sessão.
    }
    set({ preference, resolved: apply(preference) });
  },
}));

/**
 * Aplica a preferência gravada e passa a acompanhar o sistema operacional (em "seguir o sistema") e as outras
 * abas (que gravam a mesma chave). Devolve a função que para de escutar.
 */
export function startThemeSync(): () => void {
  const preference = readStoredPreference(safeStorage());
  useThemeStore.setState({ preference, resolved: apply(preference) });

  const onSystemChange = () => {
    const { preference: current } = useThemeStore.getState();
    if (current === 'system') useThemeStore.setState({ resolved: apply('system') });
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const next = isThemePreference(event.newValue) ? event.newValue : 'system';
    useThemeStore.setState({ preference: next, resolved: apply(next) });
  };

  let media: MediaQueryList | null = null;
  try {
    media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
  } catch {
    media = null;
  }
  media?.addEventListener?.('change', onSystemChange);
  window.addEventListener('storage', onStorage);

  return () => {
    media?.removeEventListener?.('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
  };
}
