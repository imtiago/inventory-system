import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { THEME_COLORS, THEME_STORAGE_KEY, applyInitialTheme, readStoredPreference, resolveTheme } from '../theme';

const html = readFileSync(resolve(__dirname, '../../../../index.html'), 'utf8');

/** O <script> inline (sem src) do <head>: é ele que roda antes da primeira pintura. */
function inlineScript(): string {
  const head = html.slice(0, html.indexOf('</head>'));
  const match = head.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('index.html sem script inline no <head>');
  return match[1];
}

function mockSystemDark(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' ? dark : false, media: query, addEventListener() {}, removeEventListener() {} }),
  });
}

function resetDom() {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.style.colorScheme = '';
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#123456';
  document.head.appendChild(meta);
}

const state = () => ({
  theme: document.documentElement.dataset.theme,
  scheme: document.documentElement.style.colorScheme,
  meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
});

const runners = {
  'função applyInitialTheme': () => applyInitialTheme(window),
  'script inline do index.html': () => new Function(inlineScript())(),
};

describe('resolveTheme / readStoredPreference', () => {
  test('system segue o sistema; light/dark são fixos', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  test('valor inválido ou ausente vira system', () => {
    expect(readStoredPreference({ getItem: () => 'roxo' })).toBe('system');
    expect(readStoredPreference({ getItem: () => null })).toBe('system');
    expect(readStoredPreference({ getItem: () => 'dark' })).toBe('dark');
    expect(readStoredPreference(null)).toBe('system');
  });

  test('getItem que lança vira system', () => {
    expect(
      readStoredPreference({
        getItem: () => {
          throw new Error('SecurityError');
        },
      }),
    ).toBe('system');
  });
});

describe.each(Object.entries(runners))('anti-flash: %s', (_name, run) => {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  beforeEach(() => {
    localStorage.clear();
    resetDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else delete (window as { matchMedia?: unknown }).matchMedia;
  });

  test('preferência dark gravada', () => {
    mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    run();
    expect(state()).toEqual({ theme: 'dark', scheme: 'dark', meta: THEME_COLORS.dark });
  });

  test('preferência light gravada ignora o sistema escuro', () => {
    mockSystemDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    run();
    expect(state()).toEqual({ theme: 'light', scheme: 'light', meta: THEME_COLORS.light });
  });

  test('sem preferência segue o sistema', () => {
    mockSystemDark(true);
    run();
    expect(state()).toEqual({ theme: 'dark', scheme: 'dark', meta: THEME_COLORS.dark });
  });

  test('localStorage bloqueado: não lança e segue o sistema', () => {
    mockSystemDark(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => run()).not.toThrow();
    expect(state().theme).toBe('dark');
  });

  test('sem matchMedia: claro', () => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    expect(() => run()).not.toThrow();
    expect(state().theme).toBe('light');
  });
});

describe('index.html', () => {
  test('script anti-flash vem antes do CSS/módulo e depois do meta theme-color', () => {
    const script = html.indexOf('<script>');
    expect(script).toBeGreaterThan(html.indexOf('name="theme-color"'));
    expect(script).toBeLessThan(html.indexOf('<script type="module"'));
    expect(script).toBeLessThan(html.indexOf('</head>'));
  });
});
