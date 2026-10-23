import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { makeCancelSaleUseCase } from "../factories/CancelSaleFactory";
import { makeGetSaleByIdUseCase } from "../factories/GetSaleByIdFactory";

const paramsSchema = z.object({
  id: z.string().uuid("Venda inválida."),
});

export function makeCancelSaleController() {
  const cancelSale = makeCancelSaleUseCase();
  const getSale = makeGetSaleByIdUseCase();
  return async function CancelSaleController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(paramsSchema, request.params);

    await cancelSale.execute({ id, userId: request.user!.sub });

    // Mesmo DTO do GET /sales/:id.
    return reply.send({ data: await getSale.execute(id) });
  };
}
