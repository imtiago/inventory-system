import { z } from "zod";
import { dateOnly } from "@finance/interfaces/http/schemas/financialDocumentQuerySchemas";

export const MAX_PERIOD_DAYS = 366;

const dayMs = 86_400_000;

export const periodShape = { from: dateOnly("Data inicial"), to: dateOnly("Data final") };
export const saleStatusShape = z.enum(["PENDING", "COMPLETED", "CANCELED"], { message: "Status inválido." });

export const validPeriod = (q: { from: string; to: string }) => q.from <= q.to;
export const periodError = { message: "A data inicial deve ser anterior ou igual à final.", path: ["to"] };
export const spanOk = (q: { from: string; to: string }) =>
  (Date.parse(q.to) - Date.parse(q.from)) / dayMs + 1 <= MAX_PERIOD_DAYS;
export const spanError = { message: `O período deve ter no máximo ${MAX_PERIOD_DAYS} dias.`, path: ["to"] };

/** Período (dias de negócio) + status de vendas: mesma regra da lista e da exportação CSV. */
export const salesPeriodQuerySchema = z
  .object({ ...periodShape, status: saleStatusShape.optional() })
  .refine(validPeriod, periodError)
  .refine(spanOk, spanError);

const both = (q: { from?: string; to?: string }) => (q.from === undefined) === (q.to === undefined);

/** Lista: período opcional, mas sempre com as duas pontas; depois, as mesmas regras do CSV. */
export const salesListFilterSchema = z
  .object({ from: periodShape.from.optional(), to: periodShape.to.optional(), status: saleStatusShape.optional() })
  .refine(both, { message: "Informe a data inicial e a data final.", path: ["to"] })
  .refine((q) => q.from === undefined || q.to === undefined || validPeriod({ from: q.from, to: q.to }), periodError)
  .refine((q) => q.from === undefined || q.to === undefined || spanOk({ from: q.from, to: q.to }), spanError);
