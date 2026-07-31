import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { z } from "zod";

export const createStockMovementSchema = z.object({
  productVariantId: z.string().uuid("Product variant id must be a valid UUID"),

  type: z.nativeEnum(StockMovementType),

  origin: z.nativeEnum(StockMovementOrigin),

  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),

  originId: z
    .string()
    .uuid("Origin id must be a valid UUID")
    .nullable()
    .optional(),

  notes: z
    .string()
    .max(500, "Notes must have maximum 500 characters")
    .nullable()
    .optional(),

  userId: z.string().uuid("User id must be a valid UUID").nullable().optional(),
});

export type CreateStockMovementSchema = z.infer<
  typeof createStockMovementSchema
>;
