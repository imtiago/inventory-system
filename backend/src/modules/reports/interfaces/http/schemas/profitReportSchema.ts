import { z } from "zod";
import { periodError, periodShape, spanError, spanOk, validPeriod } from "@sales/interfaces/http/schemas/salePeriodSchema";

export const PROFIT_VIEWS = ["period", "sale", "variant", "category"] as const;
export type ProfitView = (typeof PROFIT_VIEWS)[number];

/** Período (dias de negócio) + agrupamento + vendedor opcional; mesmas regras de período das outras exportações. */
export const profitReportQuerySchema = z
  .object({
    ...periodShape,
    view: z.enum(PROFIT_VIEWS, { message: "Agrupamento inválido." }).default("period"),
    sellerId: z.string().uuid("Vendedor inválido.").optional(),
  })
  .refine(validPeriod, periodError)
  .refine(spanOk, spanError);

export type ProfitReportQuery = z.infer<typeof profitReportQuerySchema>;
