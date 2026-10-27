export type RoundingStrategy = "STORE_TABLE" | "END_90" | "END_99" | "INTEGER" | "NONE";

interface Band {
  lo: number;
  hi: number;
  modulus: number;
  residues: number[];
}

// "Bonito" depende da faixa do próprio candidato: por isso 9,95 → 10,90 (nem 9,90 nem 10,00).
const STORE_BANDS: Band[] = [
  { lo: 0, hi: 1000, modulus: 100, residues: [50, 90] },
  { lo: 1000, hi: 10000, modulus: 100, residues: [90] },
  { lo: 10000, hi: 100000, modulus: 1000, residues: [990] },
  { lo: 100000, hi: Number.POSITIVE_INFINITY, modulus: 1000, residues: [900] },
];

function nextWithEnding(p: number, modulus: number, residue: number): number {
  const base = p - (p % modulus) + residue;
  return base >= p ? base : base + modulus;
}

function storeTable(p: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (const band of STORE_BANDS) {
    const start = Math.max(p, band.lo);
    for (const r of band.residues) {
      const q = nextWithEnding(start, band.modulus, r);
      if (q < band.hi && q < best) best = q;
    }
  }
  return best;
}

/** Arredonda o preço (centavos) para cima conforme a estratégia; nunca devolve menos que a entrada. */
export function roundPrice(cents: number, strategy: RoundingStrategy): number {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("roundPrice exige centavos inteiros ≥ 0.");
  if (cents === 0) return 0;
  switch (strategy) {
    case "STORE_TABLE":
      return storeTable(cents);
    case "END_90":
      return nextWithEnding(cents, 100, 90);
    case "END_99":
      return nextWithEnding(cents, 100, 99);
    case "INTEGER":
      return Math.ceil(cents / 100) * 100;
    case "NONE":
      return cents;
  }
}
