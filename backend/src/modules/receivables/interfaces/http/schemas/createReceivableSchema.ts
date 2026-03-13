// src/modules/receivables/interfaces/http/schemas/createReceivableSchema.ts
import { z } from "zod";

export const createReceivableSchema = z.object({
  saleId: z.string(),
  totalAmount: z.number().positive(),
  parcels: z.array(
    z.object({
      amount: z.number().positive(),
      dueDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), "Data inválida"),
    }),
  ),
});
