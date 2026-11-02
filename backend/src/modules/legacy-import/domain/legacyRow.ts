import { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import { normalizePhone, parseBrDate, parseBrMoneyToCents, parseDueDates } from "./brParsers";
import type { LegacyColumn } from "./legacyTemplate";

export type LegacyIssueCode =
  | "NAME_REQUIRED"
  | "NAME_LENGTH"
  | "TEXT_TOO_LONG"
  | "INVALID_AMOUNT"
  | "ZERO_AMOUNT"
  | "PAID_EXCEEDS_TOTAL"
  | "INVALID_DATE"
  | "INVALID_DUE_DATES"
  | "DUE_DATES_SUM_MISMATCH"
  | "UNKNOWN_PROFILE"
  | "NO_PHONE"
  | "INVALID_PHONE"
  | "NO_DATE"
  | "FUTURE_DATE"
  | "SIMILAR_CUSTOMER"
  | "SIMILAR_ROW"
  | "LINKED_CUSTOMER_MISSING";

export interface LegacyIssue {
  code: LegacyIssueCode;
  severity: "ERROR" | "WARNING";
  field: LegacyColumn | null;
  message: string;
  details?: Record<string, unknown>;
}

export interface LegacyRowData {
  name: string;
  phone: string | null;
  purchaseDate: string | null;
  description: string | null;
  totalCents: number;
  paidCents: number;
  openCents: number;
  dueDates: { date: string; amountCents: number }[] | null;
  profileCode: CreditProfileCode | null;
  notes: string | null;
}

const PROFILES: Record<string, CreditProfileCode> = {
  novo: CreditProfileCode.NEW,
  regular: CreditProfileCode.REGULAR,
  bom: CreditProfileCode.GOOD,
  excelente: CreditProfileCode.EXCELLENT,
};

/** Mesmos limites do cadastro de cliente (`createNameSchema({min:2,max:120})`) e do lançamento rápido. */
export const LEGACY_LIMITS = { nameMin: 2, nameMax: 120, description: 200, notes: 500, phone: 40 } as const;

const collapse = (s: string) => s.trim().replace(/\s+/g, " ");
const orNull = (s: string) => (collapse(s) === "" ? null : collapse(s));
const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Valida uma linha do caderninho. `today` = `YYYY-MM-DD` no fuso de negócio (vem do chamador). */
export function validateLegacyRow(
  raw: Record<LegacyColumn, string>,
  today: string,
): { data: LegacyRowData; issues: LegacyIssue[] } {
  const issues: LegacyIssue[] = [];
  const add = (
    code: LegacyIssueCode,
    severity: "ERROR" | "WARNING",
    field: LegacyColumn | null,
    message: string,
    details?: Record<string, unknown>,
  ) => issues.push({ code, severity, field, message, ...(details ? { details } : {}) });

  const name = collapse(raw.nome ?? "");
  if (name === "") add("NAME_REQUIRED", "ERROR", "nome", "Informe o nome do cliente.");
  else if (name.length < LEGACY_LIMITS.nameMin || name.length > LEGACY_LIMITS.nameMax) {
    add(
      "NAME_LENGTH",
      "ERROR",
      "nome",
      `O nome deve ter de ${LEGACY_LIMITS.nameMin} a ${LEGACY_LIMITS.nameMax} caracteres (tem ${name.length}).`,
    );
  }
  const tooLong = (field: LegacyColumn, label: string, value: string, max: number) => {
    if (value.length <= max) return false;
    add("TEXT_TOO_LONG", "ERROR", field, `${label} deve ter no máximo ${max} caracteres (tem ${value.length}).`);
    return true;
  };

  // Valores
  const totalText = (raw.valor_total ?? "").trim();
  const paidText = (raw.valor_pago ?? "").trim();
  const totalParsed = parseBrMoneyToCents(totalText);
  const paidParsed = paidText === "" ? 0 : parseBrMoneyToCents(paidText);
  let totalCents = 0;
  let paidCents = 0;
  let amountsOk = true;
  if (totalParsed === null) {
    amountsOk = false;
    add("INVALID_AMOUNT", "ERROR", "valor_total", "Valor total inválido. Use o formato 1.234,56.");
  } else totalCents = totalParsed;
  if (paidParsed === null) {
    amountsOk = false;
    add("INVALID_AMOUNT", "ERROR", "valor_pago", "Valor pago inválido. Use o formato 1.234,56.");
  } else paidCents = paidParsed;

  if (amountsOk) {
    if (paidCents > totalCents) {
      add("PAID_EXCEEDS_TOTAL", "ERROR", "valor_pago", "O valor pago é maior que o total.", {
        totalCents,
        paidCents,
      });
    } else if (totalCents - paidCents === 0) {
      add("ZERO_AMOUNT", "ERROR", "valor_total", "Não há valor em aberto (total zero ou já pago por inteiro).");
    }
  }
  const openCents = amountsOk && paidCents <= totalCents ? totalCents - paidCents : 0;

  // Celular
  const phoneText = (raw.celular ?? "").trim();
  let phone: string | null = null;
  if (phoneText === "") add("NO_PHONE", "WARNING", "celular", "Sem celular.");
  else if (tooLong("celular", "O celular", phoneText, LEGACY_LIMITS.phone)) {
    // phone fica null
  } else {
    phone = normalizePhone(phoneText);
    if (!phone) add("INVALID_PHONE", "WARNING", "celular", "Celular inválido (use DDD + número).");
  }

  // Data da compra
  const dateText = (raw.data_compra ?? "").trim();
  let purchaseDate: string | null = null;
  if (dateText === "") add("NO_DATE", "WARNING", "data_compra", "Sem data da compra.");
  else {
    purchaseDate = parseBrDate(dateText);
    if (!purchaseDate) add("INVALID_DATE", "ERROR", "data_compra", "Data inválida. Use dd/mm/aaaa.");
    else if (purchaseDate > today) add("FUTURE_DATE", "WARNING", "data_compra", "Data da compra no futuro.");
  }

  // Vencimentos
  const dueText = (raw.vencimentos ?? "").trim();
  let dueDates: { date: string; amountCents: number }[] | null = null;
  if (dueText !== "") {
    dueDates = parseDueDates(dueText);
    if (!dueDates) {
      add("INVALID_DUE_DATES", "ERROR", "vencimentos", "Vencimentos inválidos. Use dd/mm/aaaa=valor; dd/mm/aaaa=valor.");
    } else if (amountsOk && openCents > 0) {
      const sum = dueDates.reduce((acc, d) => acc + d.amountCents, 0);
      if (sum !== openCents) {
        add(
          "DUE_DATES_SUM_MISMATCH",
          "ERROR",
          "vencimentos",
          `A soma dos vencimentos (${brl(sum)}) difere do saldo em aberto (${brl(openCents)}).`,
          { sumCents: sum, openCents },
        );
      }
    }
  }

  // Perfil
  const profileText = (raw.perfil ?? "").trim();
  let profileCode: CreditProfileCode | null = null;
  if (profileText !== "") {
    profileCode = PROFILES[strip(profileText)] ?? null;
    if (!profileCode) add("UNKNOWN_PROFILE", "ERROR", "perfil", "Perfil desconhecido. Use Novo, Regular, Bom ou Excelente.");
  }

  const description = orNull(raw.descricao ?? "");
  const notes = orNull(raw.observacao ?? "");
  if (description) tooLong("descricao", "A descrição", description, LEGACY_LIMITS.description);
  if (notes) tooLong("observacao", "A observação", notes, LEGACY_LIMITS.notes);

  return {
    data: {
      name,
      phone,
      purchaseDate,
      description,
      totalCents,
      paidCents,
      openCents,
      dueDates,
      profileCode,
      notes,
    },
    issues,
  };
}
