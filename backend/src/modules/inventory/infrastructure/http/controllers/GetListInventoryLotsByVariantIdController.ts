import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeListInventoryLotsByVariantIdUseCase } from "../factories/ListInventoryLotsByVariantIdFactory";
import { listInvetoryLotsSchema } from "@inventory/interfaces/http/schemas/listInvetoryLotsSchema";

interface Params {
  productVariantId: string;
}

export function makeListInventoryLotsByVariantIdController() {
  const useCase = makeListInventoryLotsByVariantIdUseCase();
  return async function ListInventoryLotsByVariantIdController(
    request: FastifyRequest<{ Params: Params }>,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = listInvetoryLotsSchema.parse(request.query);

      const { productVariantId } = request.params;

      const data = await useCase.execute({ page, limit, productVariantId });

      return reply.send(HttpResponse.paginated(data));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
