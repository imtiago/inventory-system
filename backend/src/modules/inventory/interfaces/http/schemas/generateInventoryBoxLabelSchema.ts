import { z } from "zod";

export const generateInventoryBoxLabelParamsSchema = z.object({
  code: z.string(),
});

export const generateInventoryProductLabelsBodySchema = z.object({
  productCode: z.string(),
  quantity: z.number().int().positive(),
});
