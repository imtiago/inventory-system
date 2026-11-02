// Dados estruturados (API, reais) → colunas do CSV (texto), para uma única validação (`validateLegacyRow`).
import { toCents } from "@shared/domain/money";
import { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import { emptyRaw, type LegacyRawRow } from "./legacyBatchReview";

export interface LegacyRowDataInput {
  name?: string;
  phone?: string | null;
  purchaseDate?: string | null;
  description?: string | null;
  total?: number;
  paid?: number;
  dueDates?: { date: string; amount: number }[] | null;
  profileCode?: CreditProfileCode | null;
  notes?: string | null;
}

const PROFILE_LABEL: Record<CreditProfileCode, string> = {
  [CreditProfileCode.NEW]: "Novo",
  [CreditProfileCode.REGULAR]: "Regular",
  [CreditProfileCode.GOOD]: "Bom",
  [CreditProfileCode.EXCELLENT]: "Excelente",
};

export const moneyText = (reais: number): string => {
  const cents = toCents(reais);
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
};

/** "2026-03-05" → "05/03/2026" (outro formato passa como veio e a validação aponta o erro). */
const dateText = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** Aplica só os campos presentes em `input` sobre as colunas atuais. */
export function applyRowInput(raw: LegacyRawRow, input: LegacyRowDataInput): LegacyRawRow {
  const out = { ...emptyRaw(), ...raw };
  if (input.name !== undefined) out.nome = input.name;
  if (input.phone !== undefined) out.celular = input.phone ?? "";
  if (input.purchaseDate !== undefined) out.data_compra = input.purchaseDate === null ? "" : dateText(input.purchaseDate);
  if (input.description !== undefined) out.descricao = input.description ?? "";
  if (input.total !== undefined) out.valor_total = moneyText(input.total);
  if (input.paid !== undefined) out.valor_pago = input.paid === 0 ? "" : moneyText(input.paid);
  if (input.dueDates !== undefined) {
    out.vencimentos =
      input.dueDates === null ? "" : input.dueDates.map((d) => `${dateText(d.date)}=${moneyText(d.amount)}`).join("; ");
  }
  if (input.profileCode !== undefined) out.perfil = input.profileCode === null ? "" : PROFILE_LABEL[input.profileCode];
  if (input.notes !== undefined) out.observacao = input.notes ?? "";
  return out;
}

