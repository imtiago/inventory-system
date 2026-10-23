// CPF/CNPJ válidos aleatórios: testes paralelos precisam de documento único por teste.

function cpfDigit(base: number[]): number {
  const factor = base.length + 1;
  const sum = base.reduce((acc, d, i) => acc + d * (factor - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** CPF válido (11 dígitos, sem máscara), nunca com todos os dígitos iguais. */
export function randomCpf(): string {
  for (;;) {
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    if (new Set(base).size === 1) continue;
    const d1 = cpfDigit(base);
    const d2 = cpfDigit([...base, d1]);
    return [...base, d1, d2].join("");
  }
}

/** CNPJ válido (14 dígitos, sem máscara, matriz 0001). */
export function randomCnpj(): string {
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv = (nums: number[], w: number[]) => {
    const rest = nums.reduce((acc, d, i) => acc + d * w[i], 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  for (;;) {
    const base = [...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)), 0, 0, 0, 1];
    if (new Set(base.slice(0, 8)).size === 1) continue;
    const d1 = dv(base, w1);
    const d2 = dv([...base, d1], w2);
    return [...base, d1, d2].join("");
  }
}

/** CNPJ alfanumérico válido (12 posições [0-9A-Z] com ao menos uma letra + 2 DVs numéricos). */
export function randomAlphanumericCnpj(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv = (s: string, w: number[]) => {
    const rest = [...s].reduce((acc, c, i) => acc + (c.charCodeAt(0) - 48) * w[i], 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  for (;;) {
    const base = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    if (!/[A-Z]/.test(base)) continue;
    const d1 = dv(base, w1);
    return `${base}${d1}${dv(`${base}${d1}`, w2)}`;
  }
}
