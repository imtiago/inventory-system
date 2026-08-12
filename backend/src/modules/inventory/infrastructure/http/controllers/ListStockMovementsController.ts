import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeListStockMovementsUseCase } from "../factories/ListStockMovementsFactory";
import { listStockMovementsSchema } from "@inventory/interfaces/http/schemas/listStockMovementsSchema";

export function makeListStockMovementsController() {
  const useCase = makeListStockMovementsUseCase();
  return async function ListStockMovementsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const query = listStockMovementsSchema.parse(request.query);

      const data = await useCase.execute(query);

      return reply.send(HttpResponse.paginated(data));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
