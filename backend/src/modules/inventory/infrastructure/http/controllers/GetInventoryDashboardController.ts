import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryDashboardUseCase } from "../factories/GetInventoryDashboardFactory";

export function makeGetInventoryDashboardController() {
  const useCase = makeGetInventoryDashboardUseCase();
  return async function GetInventoryDashboardController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = await useCase.execute({});

      return reply.send(HttpResponse.ok(data));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
