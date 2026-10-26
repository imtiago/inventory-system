import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { THEME_COLORS, THEME_STORAGE_KEY } from '@/shared/theme/theme';

import { startThemeSync, useThemeStore } from '../theme';

type Listener = (event: { matches: boolean }) => void;
const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
let systemDark = false;
const listeners = new Set<Listener>();

function installMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return query === '(prefers-color-scheme: dark)' ? systemDark : false;
      },
      media: query,
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    }),
  });
}

function setSystemDark(dark: boolean) {
  systemDark = dark;
  listeners.forEach((l) => l({ matches: dark }));
}

const theme = () => document.documentElement.dataset.theme;
const meta = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');

describe('useThemeStore', () => {
  let stop: () => void = () => {};

  beforeEach(() => {
    localStorage.clear();
    systemDark = false;
    listeners.clear();
    installMedia();
    if (!document.querySelector('meta[name="theme-color"]')) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      document.head.appendChild(m);
    }
    useThemeStore.setState({ preference: 'system' });
  });

  afterEach(() => {
    stop();
    vi.restoreAllMocks();
    localStorage.clear();
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else delete (window as { matchMedia?: unknown }).matchMedia;
  });

  test('setPreference aplica data-theme, color-scheme e meta theme-color, e persiste', () => {
    stop = startThemeSync();
    useThemeStore.getState().setPreference('dark');

    expect(theme()).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(meta()).toBe(THEME_COLORS.dark);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');

    useThemeStore.getState().setPreference('light');
    expect(theme()).toBe('light');
    expect(meta()).toBe(THEME_COLORS.light);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  test('system acompanha a mudança do sistema operacional', () => {
    stop = startThemeSync();
    useThemeStore.getState().setPreference('system');
    expect(theme()).toBe('light');

    setSystemDark(true);
    expect(theme()).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');

    setSystemDark(false);
    expect(theme()).toBe('light');
  });

  test('tema fixo ignora a mudança do sistema', () => {
    stop = startThemeSync();
    useThemeStore.getState().setPreference('light');
    setSystemDark(true);
    expect(theme()).toBe('light');
  });

  test('startThemeSync aplica a preferência gravada e para de escutar ao encerrar', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    stop = startThemeSync();
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(theme()).toBe('dark');

    stop();
    stop = () => {};
    expect(listeners.size).toBe(0);
  });

  test('localStorage bloqueado: aplica o tema sem lançar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => {
      stop = startThemeSync();
      useThemeStore.getState().setPreference('dark');
    }).not.toThrow();
    expect(theme()).toBe('dark');
    expect(useThemeStore.getState().preference).toBe('dark');
  });
});
