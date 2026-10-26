import { describe, expect, test } from 'vitest';

import { passwordBytesRule } from '../password';

describe('passwordBytesRule', () => {
  test('72 bytes ASCII passam; 73 não', () => {
    expect(passwordBytesRule('a'.repeat(72))).toBe(true);
    expect(passwordBytesRule('a'.repeat(73))).toBe('A senha deve ter no máximo 72 bytes.');
  });

  test('conta bytes UTF-8, não caracteres: 36 "é" = 72 bytes passam, 37 não', () => {
    expect(passwordBytesRule('é'.repeat(36))).toBe(true);
    expect(passwordBytesRule('é'.repeat(37))).toBe('A senha deve ter no máximo 72 bytes.');
  });
});
