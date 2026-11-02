import { MAX_AMOUNT_CENTS } from "@shared/domain/limits";

/** Mesmas regras do `MoneyInput`: "," decimal, "." milhar; sem vírgula, ponto + 3 dígitos = milhar, 1–2 = decimal. */
export function parseBrMoneyToCents(text: string): number | null {
  const s = text.replace(/^\s*R\$\s*/i, "").replace(/\s+/g, "");
  if (s === "") return null;
  let intPart: string;
  let decPart = "";
  if (s.includes(",")) {
    const m = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/.exec(s);
    if (!m) return null;
    intPart = m[1].replace(/\./g, "");
    decPart = m[2];
  } else if (s.includes(".")) {
    if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) intPart = s.replace(/\./g, "");
    else {
      const m = /^(\d+)\.(\d{1,2})$/.exec(s);
      if (!m) return null;
      intPart = m[1];
      decPart = m[2];
    }
  } else {
    if (!/^\d+$/.test(s)) return null;
    intPart = s;
  }
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

/** `d/m/aaaa` ou `dd/mm/aaaa` -> `YYYY-MM-DD`; data inexistente -> null. */
export function parseBrDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Só dígitos; tira o `55` inicial quando sobram 12–13; válido = 10–11 dígitos. */
export function normalizePhone(text: string): string | null {
  let digits = text.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

/** "dd/mm/aaaa=valor; dd/mm/aaaa=valor" (valor > 0); qualquer item inválido -> null. */
export function parseDueDates(text: string): { date: string; amountCents: number }[] | null {
  const items = text.split(";").map((p) => p.trim()).filter((p) => p !== "");
  if (items.length === 0) return null;
  const out: { date: string; amountCents: number }[] = [];
  for (const item of items) {
    const eq = item.indexOf("=");
    if (eq === -1) return null;
    const date = parseBrDate(item.slice(0, eq));
    const amountCents = parseBrMoneyToCents(item.slice(eq + 1));
    if (!date || amountCents === null || amountCents <= 0) return null;
    out.push({ date, amountCents });
  }
  return out;
}
