import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = resolve(__dirname, '../..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

describe('app instalável (B6)', () => {
  test('index.html liga o manifest e o ícone da tela inicial do iOS', () => {
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
    expect(html).toMatch(/<meta name="theme-color"/);
  });

  test('manifest tem nome, standalone, cores e ícones existentes', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8'));

    expect(manifest.name).toBe('Estoque');
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.theme_color).toBe('#0f172a');
    expect(manifest.background_color).toBeTruthy();

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose?.includes('maskable'))).toBe(true);
    for (const icon of manifest.icons) expect(existsSync(resolve(root, 'public', icon.src.replace(/^\//, '')))).toBe(true);
    expect(existsSync(resolve(root, 'public/apple-touch-icon.png'))).toBe(true);
  });
});
