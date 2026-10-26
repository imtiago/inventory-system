/**
 * Tema da interface: preferência do usuário (claro, escuro ou seguir o sistema) e o tema efetivo aplicado.
 *
 * `applyInitialTheme` é a mesma lógica do <script> inline do index.html, que roda antes da primeira pintura
 * para não piscar o tema errado. O teste `theme.test.ts` executa os dois e exige o mesmo resultado:
 * ao mudar um, mude o outro.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ui.theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Cor da barra do navegador/celular: a mesma do topo do app (menu) em cada tema. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#0f172a', dark: '#020617' }; // raw-color-ok: <meta theme-color> precisa de cor literal

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Lê a preferência gravada; storage ausente, bloqueado ou valor inválido = `system`. */
export function readStoredPreference(storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreference {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

/** `localStorage` pode lançar só de ser acessado (cookies bloqueados): devolve null nesse caso. */
export function safeStorage(win: Window = window): Storage | null {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}

export function systemPrefersDark(win: Window = window): boolean {
  try {
    return typeof win.matchMedia === 'function' && win.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

/** data-theme e color-scheme na raiz (campos nativos e barra de rolagem acompanham) e a cor da barra do navegador. */
export function applyTheme(theme: ResolvedTheme, doc: Document = document) {
  const root = doc.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/** O que o script anti-flash do index.html faz. */
export function applyInitialTheme(win: Window = window): ResolvedTheme {
  const theme = resolveTheme(readStoredPreference(safeStorage(win)), systemPrefersDark(win));
  applyTheme(theme, win.document);
  return theme;
}
