import { describe, expect, test } from 'vitest';
import resolveConfig from 'tailwindcss/resolveConfig';

import config from '../../../../tailwind.config';

const theme = resolveConfig(config).theme as unknown as Record<string, Record<string, unknown>>;

describe('tailwind.config: padrões de anel', () => {
  // Esses DEFAULT viram variáveis CSS globais (--tw-ring-*) sem passar pelo <alpha-value>: com o placeholder,
  // box-shadow fica inválido e TODO ring-* some (foco invisível).
  test.each(['ringColor', 'ringOffsetColor'])('%s DEFAULT é uma cor completa, sem <alpha-value>', (key) => {
    const value = theme[key].DEFAULT;
    expect(typeof value).toBe('string');
    expect(value).not.toContain('<alpha-value>');
    expect(value).toMatch(/^rgb\(var\(--[a-z-]+\)( \/ [\d.]+)?\)$/);
  });
});
