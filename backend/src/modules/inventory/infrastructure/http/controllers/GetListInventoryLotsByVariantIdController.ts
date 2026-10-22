import { FastifyRequest, FastifyReply } from "fastify";
import { sendBadRequest } from "@shared/http/formatZodError";
import { HttpResponse } from "@shared/http/response";
import { makeListInventoryLotsByVariantIdUseCase } from "../factories/ListInventoryLotsByVariantIdFactory";
import {
  listInventoryLotsParamsSchema,
  listInvetoryLotsSchema,
} from "@inventory/interfaces/http/schemas/listInvetoryLotsSchema";

export function makeListInventoryLotsByVariantIdController() {
  const useCase = makeListInventoryLotsByVariantIdUseCase();
  return async function ListInventoryLotsByVariantIdController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = listInvetoryLotsSchema.parse(request.query);

      const { productVariantId } = listInventoryLotsParamsSchema.parse(
        request.params,
      );

      const data = await useCase.execute({ page, limit, productVariantId });

      return reply.send(HttpResponse.paginated(data));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
