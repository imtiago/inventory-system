// src/modules/sales/infrastructure/http/controllers/GetSaleController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { makeGetSaleUseCase } from "../factories/GetSaleFactory";

const paramsSchema = z.object({
  id: z.string(),
});

export function makeGetSaleController() {
  const useCase = makeGetSaleUseCase();
  return async function GetSaleController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = paramsSchema.parse(request.params);

      const sale = await useCase.execute(id);

      return reply.send(sale);
    } catch (err: any) {
      if (err.message === "Venda não encontrada") {
        return reply.status(404).send({ message: err.message });
      }

      return reply.status(400).send({ message: err.message });
    }
  };
}
