import { FastifyRequest, FastifyReply } from "fastify";
import { sendBadRequest } from "@shared/http/formatZodError";
import { makeGetInventoryByIdUseCase } from "../factories/GetInventoryByIdFactory";
import { getInventoryByIdParamsSchema } from "@inventory/interfaces/http/schemas/getInventorySchema";
import { HttpResponse } from "@shared/http/response";

export function makeGetInventoryByIdController() {
  const useCase = makeGetInventoryByIdUseCase();
  return async function GetInventoryByIdController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = getInventoryByIdParamsSchema.parse(request.params);

      const inventory = await useCase.execute(id);
      if (!inventory) {
        return reply.status(404).send({ message: "Inventory not found" });
      }

      return reply.send(HttpResponse.ok(inventory));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
