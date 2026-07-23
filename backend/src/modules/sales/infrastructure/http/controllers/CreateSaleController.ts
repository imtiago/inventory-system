import { FastifyRequest, FastifyReply } from "fastify";
import { createSaleSchema } from "../../../interfaces/http/schemas/createSaleSchema";
import { makeCreateSaleUseCase } from "../factories/CreateSaleFactory";

export function makeCreateSaleController() {
  const useCase = makeCreateSaleUseCase();
  return async function CreateSaleController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createSaleSchema.parse(request.body);

      const sale = await useCase.execute(data);

      return reply.status(201).send(sale);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
