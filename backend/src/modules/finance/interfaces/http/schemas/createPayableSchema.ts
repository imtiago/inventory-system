// src/modules/payables/interfaces/http/schemas/createPayableSchema.ts
import { z } from "zod";

export const createPayableSchema = z.object({
  purchaseId: z.string(),
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
