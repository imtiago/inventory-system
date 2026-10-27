import { z } from "zod";

const reason = z
  .string({ message: "Informe o motivo." })
  .trim()
  .min(3, "O motivo deve ter ao menos 3 caracteres.")
  .max(200, "O motivo deve ter no máximo 200 caracteres.");

export const saleIdParamsSchema = z.object({ id: z.string().uuid("Venda inválida.") });
export const requestIdParamsSchema = z.object({ id: z.string().uuid("Pedido inválido.") });
export const cancelReasonBodySchema = z.object({ reason });
export const cancelRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"], { message: "Status inválido." }).optional(),
});
