import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { createSaleSchema } from "../../../interfaces/http/schemas/createSaleSchema";
import { makeCreateSaleUseCase } from "../factories/CreateSaleFactory";

export function makeCreateSaleController() {
  const useCase = makeCreateSaleUseCase();
  return async function CreateSaleController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(createSaleSchema, request.body);

    const sale = await useCase.execute(data);

    return reply.status(201).send(sale);
  };
}
