import { z } from "zod";
import { MAX_AMOUNT } from "@shared/domain/limits";
import { toCents } from "@shared/domain/money";
import { percentToBps } from "@shared/domain/percent";
import { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { CreditRules } from "@credit/domain/creditRules";
import { CreditStatus } from "@credit/domain/customerCredit";

const MAX_INSTALLMENTS = 24;
const hasAtMostTwoDecimals = (v: number) => Number.isFinite(v) && Number.isInteger(Number((v * 100).toPrecision(15)));

const int = (min: number, max: number, label: string) =>
  z
    .number({ error: `Informe ${label}.` })
    .int(`${label[0].toUpperCase()}${label.slice(1)} deve ser um número inteiro.`)
    .min(min, `${label[0].toUpperCase()}${label.slice(1)} deve ser no mínimo ${min}.`)
    .max(max, `${label[0].toUpperCase()}${label.slice(1)} deve ser no máximo ${max}.`);

const profileCode = z.enum(CreditProfileCode, { error: "Perfil de crédito inválido." });

// ---------------------------------------------------------------------------------------------
// Forma guardada (centavos/bps): valida o JSON de `CreditSettings.rules` na escrita e na leitura.
// A multa acima de 2% não é barrada aqui: é regra de negócio (422 FINE_ABOVE_LEGAL_LIMIT no use case).
// ---------------------------------------------------------------------------------------------

const bandsSchema = z
  .array(
    z.object({
      upToCents: z.number().int().positive("O teto da faixa deve ser maior que zero.").nullable(),
      maxInstallments: int(1, MAX_INSTALLMENTS, "o máximo de parcelas da faixa"),
    }),
  )
  .min(1, "Informe ao menos uma faixa.")
  .max(20, "No máximo 20 faixas.")
  .superRefine((bands, ctx) => {
    bands.forEach((b, i) => {
      const last = i === bands.length - 1;
      if (last && b.upToCents !== null) {
        ctx.addIssue({ code: "custom", path: [i, "upTo"], message: "A última faixa deve ser \"acima\" (sem teto)." });
      }
      if (!last && b.upToCents === null) {
        ctx.addIssue({ code: "custom", path: [i, "upTo"], message: "Só a última faixa pode ficar sem teto." });
      }
      const prev = i > 0 ? bands[i - 1].upToCents : null;
      if (i > 0 && prev !== null && b.upToCents !== null && b.upToCents <= prev) {
        ctx.addIssue({ code: "custom", path: [i, "upTo"], message: "As faixas devem estar em ordem crescente de valor." });
      }
    });
  });

const weightsSchema = z.object({
  paidOnTime: int(-1000, 1000, "o peso"),
  relationshipMonth: int(-1000, 1000, "o peso"),
  relationshipMonthsCap: int(0, 1200, "o teto"),
  per100Paid: int(-1000, 1000, "o peso"),
  per100PaidCap: int(0, 100000, "o teto"),
  dayLate: int(-1000, 1000, "o peso"),
  paidLate30: int(-1000, 1000, "o peso"),
  renegotiation: int(-1000, 1000, "o peso"),
});

const reviewSchema = z.object({
  weights: weightsSchema,
  promoteAt: z.object({
    NEW: int(-100000, 100000, "a pontuação"),
    REGULAR: int(-100000, 100000, "a pontuação"),
    GOOD: int(-100000, 100000, "a pontuação"),
  }),
  demoteIfDaysLateOver: int(0, 3650, "os dias"),
  suspendIfOverdueOver: int(0, 3650, "os dias"),
});

const uniqueProfiles = z
  .array(profileCode)
  .max(4)
  .refine((v) => new Set(v).size === v.length, "Perfil repetido.");

export const creditRulesSchema: z.ZodType<CreditRules, CreditRules> = z.object({
  bands: bandsSchema,
  minInstallmentCents: z.number().int().min(1, "A parcela mínima deve ser maior que zero.").max(toCents(MAX_AMOUNT)),
  interestFreeInstallments: int(0, MAX_INSTALLMENTS, "as parcelas sem acréscimo"),
  monthlyRateBps: int(0, 9999, "a taxa mensal"),
  defaultDueDay: int(1, 28, "o dia de vencimento").nullable(),
  overdueBlockDays: int(0, 365, "os dias de atraso para bloqueio"),
  fineBps: int(0, 9999, "a multa"),
  monthlyInterestBps: int(0, 9999, "os juros"),
  graceDays: int(0, 60, "a carência"),
  autoApproval: z.object({
    profiles: uniqueProfiles,
    maxDaysLate: int(0, 365, "os dias de atraso"),
    minPaidInstallments: int(0, 1000, "as parcelas pagas"),
    maxIncreaseBps: int(0, 100000, "o aumento máximo"),
  }),
  review: reviewSchema,
});

// ---------------------------------------------------------------------------------------------
// Forma da API (reais/percentuais) → CreditRules.
// ---------------------------------------------------------------------------------------------

const money = (label: string) =>
  z
    .number({ error: `Informe ${label}.` })
    .min(0, "Valor inválido.")
    .max(MAX_AMOUNT, "Valor muito alto.")
    .refine(hasAtMostTwoDecimals, "Use no máximo 2 casas decimais.");

const percent = (label: string, max = 100) =>
  z
    .number({ error: `Informe ${label}.` })
    .refine((v) => Number.isFinite(v) && v >= 0 && v < max, `O percentual deve estar entre 0 e menos de ${max}.`)
    .refine(hasAtMostTwoDecimals, "Use no máximo 2 casas decimais.")
    .transform((v) => percentToBps(v));

export const creditRulesInputSchema = z
  .object({
    bands: z
      .array(
        z.object({
          upTo: money("o teto da faixa").nullable(),
          maxInstallments: z.number(),
        }),
      )
      .max(20, "No máximo 20 faixas."),
    minInstallment: money("a parcela mínima"),
    interestFreeInstallments: z.number(),
    monthlyRatePercent: percent("a taxa mensal"),
    defaultDueDay: z.number().nullable(),
    overdueBlockDays: z.number(),
    finePercent: percent("a multa"),
    monthlyInterestPercent: percent("os juros"),
    graceDays: z.number(),
    autoApproval: z.object({
      profiles: z.array(profileCode),
      maxDaysLate: z.number(),
      minPaidInstallments: z.number(),
      maxIncreasePercent: percent("o aumento máximo", 1000),
    }),
    review: reviewSchema,
  })
  .transform(
    (r): CreditRules => ({
      bands: r.bands.map((b) => ({ upToCents: b.upTo === null ? null : toCents(b.upTo), maxInstallments: b.maxInstallments })),
      minInstallmentCents: toCents(r.minInstallment),
      interestFreeInstallments: r.interestFreeInstallments,
      monthlyRateBps: r.monthlyRatePercent,
      defaultDueDay: r.defaultDueDay,
      overdueBlockDays: r.overdueBlockDays,
      fineBps: r.finePercent,
      monthlyInterestBps: r.monthlyInterestPercent,
      graceDays: r.graceDays,
      autoApproval: {
        profiles: r.autoApproval.profiles,
        maxDaysLate: r.autoApproval.maxDaysLate,
        minPaidInstallments: r.autoApproval.minPaidInstallments,
        maxIncreaseBps: r.autoApproval.maxIncreasePercent,
      },
      review: r.review,
    }),
  )
  .pipe(creditRulesSchema);

export const updateCreditSettingsSchema = z
  .object({
    crediarioEnabled: z.boolean({ error: "Informe verdadeiro ou falso." }).optional(),
    rules: creditRulesInputSchema.optional(),
  })
  .refine((v) => v.crediarioEnabled !== undefined || v.rules !== undefined, {
    message: "Informe o que alterar.",
    path: ["rules"],
  });

export const creditProfileParamsSchema = z.object({ code: profileCode });

export const updateCreditProfileSchema = z.object({
  initialLimit: money("o limite inicial"),
  minDownPaymentPercent: z
    .number({ error: "Informe a entrada mínima." })
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 100, "A entrada mínima deve estar entre 0 e 100%.")
    .refine(hasAtMostTwoDecimals, "Use no máximo 2 casas decimais.")
    .transform((v) => percentToBps(v)),
  maxInstallments: int(1, MAX_INSTALLMENTS, "o máximo de parcelas"),
});

export const customerCreditParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export const updateCustomerCreditSchema = z
  .object({
    profileCode: profileCode.optional(),
    limit: money("o limite").optional(),
    status: z.enum(CreditStatus, { error: "Situação inválida." }).optional(),
    reason: z
      .string({ error: "Informe o motivo." })
      .trim()
      .min(3, "O motivo deve ter ao menos 3 caracteres.")
      .max(300, "O motivo deve ter no máximo 300 caracteres."),
  })
  .refine((v) => v.profileCode !== undefined || v.limit !== undefined || v.status !== undefined, {
    message: "Informe o perfil, o limite ou a situação.",
    path: ["profileCode"],
  });

// ---------------------------------------------------------------------------------------------
// Pedidos de aumento de limite
// ---------------------------------------------------------------------------------------------

const requestReason = (max: number) =>
  z
    .string({ error: "Informe o motivo." })
    .trim()
    .min(3, "O motivo deve ter ao menos 3 caracteres.")
    .max(max, `O motivo deve ter no máximo ${max} caracteres.`);

const positiveMoney = (label: string) => money(label).refine((v) => v > 0, "O valor deve ser maior que zero.");

export const createLimitRequestSchema = z.object({
  customerId: z.string({ error: "Informe o cliente." }).uuid("Cliente inválido."),
  requestedLimit: positiveMoney("o limite pedido"),
  reason: requestReason(300),
});

export const limitRequestParamsSchema = z.object({ id: z.string().uuid("Pedido inválido.") });

export const approveLimitRequestSchema = z.object({
  approvedLimit: positiveMoney("o limite aprovado").optional(),
  reason: requestReason(200).optional(),
});

export const rejectLimitRequestSchema = z.object({ reason: requestReason(300) });

export const limitRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"], { error: "Status inválido." }).optional(),
});
