import { z } from "zod";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" que existe no calendário. */
const dateOnly = (label: string) =>
  z
    .string()
    .regex(DATE_ONLY, `${label} deve estar no formato AAAA-MM-DD.`)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, `${label} inválida.`);

export const listReceivablesQuerySchema = paginationSchema
  .extend({
    status: z
      .enum(["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELED"], { message: "Status inválido." })
      .optional(),
    customerId: z.string().uuid("Cliente inválido.").optional(),
    dueFrom: dateOnly("Data inicial").optional(),
    dueTo: dateOnly("Data final").optional(),
  })
  .refine((q) => !q.dueFrom || !q.dueTo || q.dueFrom <= q.dueTo, {
    message: "A data inicial deve ser anterior ou igual à final.",
    path: ["dueTo"],
  });

export const receivableParamsSchema = z.object({
  id: z.string().uuid("Conta a receber inválida."),
});
