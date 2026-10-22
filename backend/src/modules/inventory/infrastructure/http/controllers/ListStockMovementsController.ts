import { FastifyRequest, FastifyReply } from "fastify";
import { sendBadRequest } from "@shared/http/formatZodError";
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
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
