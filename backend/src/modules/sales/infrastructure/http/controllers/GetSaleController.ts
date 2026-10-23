import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { makeGetSaleByIdUseCase } from "../factories/GetSaleByIdFactory";

const paramsSchema = z.object({
  id: z.string().uuid("Venda inválida."),
});

export function makeGetSaleController() {
  const useCase = makeGetSaleByIdUseCase();
  return async function GetSaleController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(paramsSchema, request.params);

    const sale = await useCase.execute(id);

    return reply.send({ data: sale });
  };
}
