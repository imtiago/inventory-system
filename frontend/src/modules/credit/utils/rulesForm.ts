import { formatMoneyInput, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';
import { formatPercentInput, parsePercentToBps } from '@/shared/utils/percent';

import type { CreditProfileCode, CreditRules } from '../types';

/** Multa por atraso: teto legal (a API também barra com 422 FINE_ABOVE_LEGAL_LIMIT). */
export const MAX_FINE_BPS = 200;
export const MAX_INSTALLMENTS = 24;

export interface WeightValues {
  paidOnTime: string;
  relationshipMonth: string;
  relationshipMonthsCap: string;
  per100Paid: string;
  per100PaidCap: string;
  dayLate: string;
  paidLate30: string;
  renegotiation: string;
}

/** Tudo como texto digitado: o servidor recebe reais/percentuais só depois de validar. */
export interface RulesFormValues {
  bands: { upTo: string; maxInstallments: string }[];
  minInstallment: string;
  interestFreeInstallments: string;
  monthlyRate: string;
  defaultDueDay: string;
  overdueBlockDays: string;
  fine: string;
  monthlyInterest: string;
  graceDays: string;
  autoProfiles: CreditProfileCode[];
  autoMaxDaysLate: string;
  autoMinPaid: string;
  autoMaxIncrease: string;
  weights: WeightValues;
  promoteNew: string;
  promoteRegular: string;
  promoteGood: string;
  demoteDays: string;
  suspendDays: string;
}

const text = (n: number) => String(n);

export function toFormValues(rules: CreditRules): RulesFormValues {
  const w = rules.review.weights;

  return {
    bands: rules.bands.map((b) => ({ upTo: b.upTo === null ? '' : formatMoneyInput(b.upTo), maxInstallments: text(b.maxInstallments) })),
    minInstallment: formatMoneyInput(rules.minInstallment),
    interestFreeInstallments: text(rules.interestFreeInstallments),
    monthlyRate: formatPercentInput(rules.monthlyRatePercent),
    defaultDueDay: rules.defaultDueDay === null ? '' : text(rules.defaultDueDay),
    overdueBlockDays: text(rules.overdueBlockDays),
    fine: formatPercentInput(rules.finePercent),
    monthlyInterest: formatPercentInput(rules.monthlyInterestPercent),
    graceDays: text(rules.graceDays),
    autoProfiles: [...rules.autoApproval.profiles],
    autoMaxDaysLate: text(rules.autoApproval.maxDaysLate),
    autoMinPaid: text(rules.autoApproval.minPaidInstallments),
    autoMaxIncrease: formatPercentInput(rules.autoApproval.maxIncreasePercent),
    weights: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, text(v)])) as unknown as WeightValues,
    promoteNew: text(rules.review.promoteAt.NEW),
    promoteRegular: text(rules.review.promoteAt.REGULAR),
    promoteGood: text(rules.review.promoteAt.GOOD),
    demoteDays: text(rules.review.demoteIfDaysLateOver),
    suspendDays: text(rules.review.suspendIfOverdueOver),
  };
}

/** Texto -> inteiro (aceita sinal), ou null se vazio/inválido. */
export function parseIntText(value: string): number | null {
  const trimmed = value.trim();

  return /^-?\d+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed)) ? Number(trimmed) : null;
}

export function intError(value: string, { min = 0, max, optional = false }: { min?: number; max?: number; optional?: boolean } = {}): string | null {
  if (value.trim() === '') return optional ? null : 'Informe um número';

  const n = parseIntText(value);
  if (n === null) return 'Use um número inteiro';
  if (n < min) return `O mínimo é ${min}`;
  if (max !== undefined && n > max) return `O máximo é ${max}`;

  return null;
}

/** Percentual entre 0 e `maxBps` (inclusive), com a mensagem pedida para o teto. */
export function percentRangeError(value: string, maxBps: number, maxMessage: string): string | null {
  const parsed = parsePercentToBps(value);

  switch (parsed.kind) {
    case 'empty':
      return 'Informe um percentual';
    case 'invalid':
      return 'Percentual inválido';
    case 'decimals':
      return 'Use no máximo 2 casas decimais';
    default:
      return parsed.bps > maxBps ? maxMessage : null;
  }
}

/** Faixa: teto obrigatório e maior que o da faixa anterior (a última faixa é "acima" e não tem teto). */
export function bandCeilingError(value: string, previous: string | undefined): string | null {
  const base = moneyTextError(value);
  if (base) return base;

  const cents = parseMoneyToCents(value) ?? 0;
  if (cents <= 0) return 'O teto deve ser maior que zero';

  const previousCents = previous === undefined ? null : parseMoneyToCents(previous);

  return previousCents !== null && cents <= previousCents ? 'Use um valor maior que o da faixa anterior' : null;
}

const percentOf = (value: string) => (parsePercentToBps(value).kind === 'ok' ? (parsePercentToBps(value) as { bps: number }).bps / 100 : 0);
const reaisOf = (value: string) => (parseMoneyToCents(value) ?? 0) / 100;
const intOf = (value: string) => parseIntText(value) ?? 0;

/** Valores já validados -> corpo da API (reais, percentuais, pontos). */
export function toRules(values: RulesFormValues): CreditRules {
  const lastIndex = values.bands.length - 1;
  const w = values.weights;

  return {
    bands: values.bands.map((b, i) => ({ upTo: i === lastIndex ? null : reaisOf(b.upTo), maxInstallments: intOf(b.maxInstallments) })),
    minInstallment: reaisOf(values.minInstallment),
    interestFreeInstallments: intOf(values.interestFreeInstallments),
    monthlyRatePercent: percentOf(values.monthlyRate),
    defaultDueDay: values.defaultDueDay.trim() === '' ? null : intOf(values.defaultDueDay),
    overdueBlockDays: intOf(values.overdueBlockDays),
    finePercent: percentOf(values.fine),
    monthlyInterestPercent: percentOf(values.monthlyInterest),
    graceDays: intOf(values.graceDays),
    autoApproval: {
      profiles: values.autoProfiles,
      maxDaysLate: intOf(values.autoMaxDaysLate),
      minPaidInstallments: intOf(values.autoMinPaid),
      maxIncreasePercent: percentOf(values.autoMaxIncrease),
    },
    review: {
      weights: {
        paidOnTime: intOf(w.paidOnTime),
        relationshipMonth: intOf(w.relationshipMonth),
        relationshipMonthsCap: intOf(w.relationshipMonthsCap),
        per100Paid: intOf(w.per100Paid),
        per100PaidCap: intOf(w.per100PaidCap),
        dayLate: intOf(w.dayLate),
        paidLate30: intOf(w.paidLate30),
        renegotiation: intOf(w.renegotiation),
      },
      promoteAt: { NEW: intOf(values.promoteNew), REGULAR: intOf(values.promoteRegular), GOOD: intOf(values.promoteGood) },
      demoteIfDaysLateOver: intOf(values.demoteDays),
      suspendIfOverdueOver: intOf(values.suspendDays),
    },
  };
}
