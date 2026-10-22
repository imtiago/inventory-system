import { FastifyRequest, FastifyReply } from "fastify";
import { sendBadRequest } from "@shared/http/formatZodError";
import { makeListInventoryUseCase } from "../factories/ListInventoryFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { HttpResponse } from "@shared/http/response";

export function makeListInventoryController() {
  const useCase = makeListInventoryUseCase();
  return async function ListInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = paginationSchema.parse(request.query);

      const listInventory = await useCase.execute({ page, limit });

      return reply.send(HttpResponse.paginated(listInventory));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
