import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { listInventoryBoxesSchema } from "@inventory/interfaces/http/schemas/listInventoryBoxesSchema";
import { makeListInventoryBoxesUseCase } from "../factories/ListInventoryBoxesFactory";

export function makeListInventoryBoxesController() {
  const useCase = makeListInventoryBoxesUseCase();

  return async function ListInventoryBoxesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const query = listInventoryBoxesSchema.parse(request.query);
      const data = await useCase.execute(query);

      return reply.send(HttpResponse.paginated(data));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
