import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetInventoryByIdUseCase } from "../factories/GetInventoryByIdFactory";
import { HttpResponse } from "@shared/http/response";

export function makeGetInventoryByIdController() {
  const useCase = makeGetInventoryByIdUseCase();
  return async function GetInventoryByIdController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params;

      const inventory = await useCase.execute(id);
      if (!inventory) {
        return reply.status(404).send({ message: "Inventory not found" });
      }

      return reply.send(HttpResponse.ok(inventory));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
