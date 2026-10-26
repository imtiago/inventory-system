import { z } from "zod";
import { percentToBps } from "@shared/domain/percent";
import { toCents } from "@shared/domain/money";
import { expenseBpsFromMonthly } from "@pricing/domain/pricingMath";
import { createNameSchema } from "@shared/interfaces/http/schemas/nameSchema";

/** Percentual 0 ≤ x < 100 com até 2 casas → bps. */
const percentField = z
  .number({ error: "Informe um percentual." })
  .refine((v) => Number.isFinite(v) && v >= 0 && v < 100, "O percentual deve estar entre 0 e menos de 100.")
  .refine((v) => Number.isFinite(v) && Math.abs(Number((v * 100).toPrecision(15)) - Math.round(v * 100)) <= 1e-9, "Use no máximo 2 casas decimais.")
  .transform((v) => percentToBps(v));

const creditShape = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), percentField]));

export const updateSettingsSchema = z.object({
  defaultMarginPercent: percentField,
  roundingStrategy: z.enum(["STORE_TABLE", "END_90", "END_99", "INTEGER", "NONE"]),
  alertThresholdPercent: percentField,
  cardFees: z.object({
    debitPercent: percentField,
    creditPercent: z.object(creditShape).strict(),
  }),
});

const money = z.number({ error: "Informe um valor." }).min(0, "Valor inválido.").max(999_999_999, "Valor muito alto.");

export const expenseBodySchema = z
  .object({
    name: createNameSchema({ max: 80 }),
    percent: percentField.optional(),
    monthlyAmount: money.optional(),
    monthlyRevenue: money.optional(),
    active: z.boolean().optional(),
    position: z.number().int().min(0).max(100000).optional(),
  })
  .superRefine((v, ctx) => {
    const helper = v.monthlyAmount !== undefined || v.monthlyRevenue !== undefined;
    if (v.percent !== undefined && helper) {
      ctx.addIssue({ code: "custom", path: ["percent"], message: "Informe o percentual ou os valores mensais, não os dois." });
    } else if (v.percent === undefined && !helper) {
      ctx.addIssue({ code: "custom", path: ["percent"], message: "Informe o percentual ou os valores mensais." });
    } else if (helper) {
      if (v.monthlyAmount === undefined) ctx.addIssue({ code: "custom", path: ["monthlyAmount"], message: "Informe o valor mensal." });
      if (v.monthlyRevenue === undefined || toCents(v.monthlyRevenue) <= 0) {
        ctx.addIssue({ code: "custom", path: ["monthlyRevenue"], message: "O faturamento mensal deve ser maior que zero." });
      }
    }
  })
  .transform((v, ctx) => {
    let percentBps = v.percent;
    if (percentBps === undefined) {
      percentBps = expenseBpsFromMonthly(toCents(v.monthlyAmount!), toCents(v.monthlyRevenue!));
      if (percentBps > 9999) {
        ctx.addIssue({ code: "custom", path: ["monthlyAmount"], message: "A despesa deve ser menor que 100% do faturamento." });
        return z.NEVER;
      }
    }
    return { name: v.name, percentBps, active: v.active ?? true, position: v.position };
  });

export const expenseIdParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export const targetMarginParamsSchema = z.object({
  level: z.enum(["category", "product", "variant"]),
  id: z.string().uuid("Identificador inválido."),
});

export const targetMarginBodySchema = z.object({
  targetMarginPercent: z.union([percentField, z.null()]),
});
