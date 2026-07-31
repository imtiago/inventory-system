import { FastifyRequest, FastifyReply } from "fastify";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { HttpResponse } from "@shared/http/response";
import { makeListStockMovementsUseCase } from "../factories/ListStockMovementsFactory";

export function makeListStockMovementsController() {
  const useCase = makeListStockMovementsUseCase();
  return async function ListStockMovementsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = paginationSchema.parse(request.query);

      const data = await useCase.execute({ page, limit });

      return reply.send(HttpResponse.paginated(data));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
