// /src/modules/customer/interfaces/http/schemas/createCustomerSchema.ts
import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string(), // obrigatório
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});
