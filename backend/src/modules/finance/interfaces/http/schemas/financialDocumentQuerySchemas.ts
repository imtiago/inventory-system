import { z } from "zod";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FINANCIAL_TYPE_LABEL } from "@finance/domain/enums/financialTypeLabels";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" que existe no calendário. */
export const dateOnly = (label: string) =>
  z
    .string()
    .regex(DATE_ONLY, `${label} deve estar no formato AAAA-MM-DD.`)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, `${label} inválida.`);

const listQueryBase = paginationSchema.extend({
  status: z
    .enum(["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELED"], { message: "Status inválido." })
    .optional(),
  dueFrom: dateOnly("Data inicial").optional(),
  dueTo: dateOnly("Data final").optional(),
  openOnly: z
    .enum(["true", "false"], { message: "openOnly deve ser true ou false." })
    .transform((v) => v === "true")
    .optional(),
});

const validDueRange = (q: { dueFrom?: string; dueTo?: string }) => !q.dueFrom || !q.dueTo || q.dueFrom <= q.dueTo;
const dueRangeError = { message: "A data inicial deve ser anterior ou igual à final.", path: ["dueTo"] };

export const listReceivablesQuerySchema = listQueryBase
  .extend({ customerId: z.string().uuid("Cliente inválido.").optional() })
  .refine(validDueRange, dueRangeError);

export const listPayablesQuerySchema = listQueryBase
  .extend({ supplierId: z.string().uuid("Fornecedor inválido.").optional() })
  .refine(validDueRange, dueRangeError);

export const documentParamsSchema = (type: FinancialType) =>
  z.object({ id: z.string().uuid(`${FINANCIAL_TYPE_LABEL[type]} inválida.`) });
