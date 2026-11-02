// Detecção conservadora de nomes parecidos (puro, sem banco). Prefere deixar passar
// um parecido a acusar duas pessoas diferentes ("Maria Silva" × "Mariana Silva").

export type NameMatch = "SAME" | "SIMILAR";
export type SimilarMatch = NameMatch | "PHONE";

const PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

/** Tokens: sem acento, minúsculas, '.' e '-' viram espaço, outra pontuação some, sem partículas. */
export function normalizeName(name: string): string[] {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.\-]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned.split(" ").filter((t) => !PARTICLES.has(t));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const isInitialOf = (a: string, b: string): boolean =>
  (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

function abbreviation(a: string[], b: string[]): boolean {
  if (a.length === 1 || b.length === 1) {
    const [one, other] = a.length === 1 ? [a, b] : [b, a];
    return one[0] === other[0] && one[0].length >= 3;
  }
  if (a.length !== b.length) return false;
  if (a[0] !== b[0] && !isInitialOf(a[0], b[0])) return false;
  let strong = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) {
      if (a[i].length >= 3) strong = true;
    } else if (!isInitialOf(a[i], b[i])) {
      return false;
    }
  }
  return strong;
}

function typo(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  let diff = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (diff !== -1) return false;
    diff = i;
  }
  if (diff === -1) return false;
  const x = a[diff];
  const y = b[diff];
  return x.length >= 5 && y.length >= 5 && x[0] === y[0] && levenshtein(x, y) === 1;
}

function matchTokens(a: string[], b: string[]): NameMatch | null {
  if (a.length === 0 || b.length === 0) return null;
  if (a.length === b.length && a.every((t, i) => t === b[i])) return "SAME";
  return abbreviation(a, b) || typo(a, b) ? "SIMILAR" : null;
}

export function nameMatch(a: string, b: string): NameMatch | null {
  return matchTokens(normalizeName(a), normalizeName(b));
}

/** Celular só com dígitos (sem +55), ou null se curto demais. */
export function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d : null;
}

const MAX_RESULTS = 5;

interface IndexedCandidate {
  order: number;
  id: string;
  tokens: string[];
  phone: string | null;
}

/**
 * Candidatos normalizados uma vez e agrupados pela inicial do 1º termo: todo SAME/SIMILAR tem a mesma
 * inicial no 1º termo (igualdade, abreviação "M. Silva", erro de digitação no 1º nome que mantém a 1ª letra),
 * então só o grupo da inicial precisa de comparação; o celular entra por um mapa à parte.
 * `add` aceita candidatos aos poucos (linhas anteriores do lote).
 */
export class SimilarityIndex {
  private readonly byInitial = new Map<string, IndexedCandidate[]>();
  private readonly byPhone = new Map<string, IndexedCandidate[]>();
  private size = 0;

  constructor(candidates: { id: string; name: string; phone?: string | null }[] = []) {
    for (const c of candidates) this.add(c.id, normalizeName(c.name), c.phone);
  }

  add(id: string, tokens: string[], phone?: string | null): void {
    const entry: IndexedCandidate = { order: this.size++, id, tokens, phone: phoneKey(phone) };
    if (tokens.length > 0) {
      const initial = tokens[0][0];
      const list = this.byInitial.get(initial);
      if (list) list.push(entry);
      else this.byInitial.set(initial, [entry]);
    }
    if (entry.phone) {
      const list = this.byPhone.get(entry.phone);
      if (list) list.push(entry);
      else this.byPhone.set(entry.phone, [entry]);
    }
  }

  /** Mesmo resultado de comparar com todos, na ordem dos candidatos: fortes (SAME/PHONE) e depois SIMILAR, até 5. */
  find(tokens: string[], phone?: string | null): { id: string; match: SimilarMatch }[] {
    const key = phoneKey(phone);
    const pool = new Map<number, IndexedCandidate>();
    if (tokens.length > 0) for (const c of this.byInitial.get(tokens[0][0]) ?? []) pool.set(c.order, c);
    if (key) for (const c of this.byPhone.get(key) ?? []) pool.set(c.order, c);
    const ordered = [...pool.values()].sort((a, b) => a.order - b.order);
    const strong: { id: string; match: SimilarMatch }[] = [];
    const weak: { id: string; match: SimilarMatch }[] = [];
    for (const c of ordered) {
      const byName = matchTokens(tokens, c.tokens);
      if (byName === "SAME") strong.push({ id: c.id, match: "SAME" });
      else if (key !== null && c.phone === key) strong.push({ id: c.id, match: "PHONE" });
      else if (byName === "SIMILAR") weak.push({ id: c.id, match: "SIMILAR" });
    }
    return [...strong, ...weak].slice(0, MAX_RESULTS);
  }
}

export function findSimilar(
  name: string,
  candidates: { id: string; name: string; phone?: string | null }[],
  phone?: string | null,
): { id: string; match: SimilarMatch }[] {
  return new SimilarityIndex(candidates).find(normalizeName(name), phone);
}
