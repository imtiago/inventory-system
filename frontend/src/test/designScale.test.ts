import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Escala visual única (B7):
 * - raios: `rounded-lg` em controles e itens, `rounded-xl` em superfícies (cartões, seções, modais),
 *   `rounded-full` em pílulas/avatares. `rounded`, `rounded-md` e `rounded-2xl` não entram.
 * - sombras: `shadow` em cartões, `shadow-lg` em camadas flutuantes (modal, menu, lista de opções).
 *   `shadow-sm`, `shadow-xl` e `shadow-2xl` não entram.
 */
const FORBIDDEN = [
  { pattern: /(?<![\w-])rounded(?![\w-])/, hint: 'use rounded-lg' },
  { pattern: /(?<![\w-])rounded-md(?![\w-])/, hint: 'use rounded-lg' },
  { pattern: /(?<![\w-])rounded-2xl(?![\w-])/, hint: 'use rounded-xl' },
  { pattern: /(?<![\w-])shadow-sm(?![\w-])/, hint: 'use shadow' },
  { pattern: /(?<![\w-])shadow-(xl|2xl)(?![\w-])/, hint: 'use shadow-lg' },
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'test' ? [] : sourceFiles(full);
    return /\.(tsx|css)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

describe('escala de cantos e sombras', () => {
  test('nenhum componente usa classes fora da escala', () => {
    const root = path.resolve(__dirname, '..');
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        for (const { pattern, hint } of FORBIDDEN) {
          if (pattern.test(line)) offenders.push(`${path.relative(root, file)}:${index + 1} (${hint})`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
