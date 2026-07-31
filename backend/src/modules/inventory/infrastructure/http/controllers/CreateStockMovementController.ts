import { FastifyRequest, FastifyReply } from "fastify";
import { createStockMovementSchema } from "@inventory/interfaces/http/schemas/createStockMovementSchema";
import { HttpResponse } from "@shared/http/response";
import { makeCreateStockMovementFactory } from "../factories/CreateStockMovementFactory";

export function makeCreateStockMovementController() {
  const useCase = makeCreateStockMovementFactory();
  return async function CreateStockMovementController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createStockMovementSchema.parse(request.body);

      const movement = await useCase.execute(data);

      return reply.send(HttpResponse.created(movement));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
