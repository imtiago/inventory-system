import { z } from "zod";

export const MAX_BALANCE_IDS = 100;

// ?productVariantIds=a,b,c — 1 a 100 uuids (repetidos contam uma vez).
export const listInventoryBalancesSchema = z.object({
  productVariantIds: z
    .string()
    .transform((value) => value.split(",").map((id) => id.trim()))
    .pipe(z.array(z.string().uuid("ID da variante inválido.")).min(1).max(MAX_BALANCE_IDS))
    .transform((ids) => [...new Set(ids)]),
});
