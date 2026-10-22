import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryDashboardUseCase } from "../factories/GetInventoryDashboardFactory";

export function makeGetInventoryDashboardController() {
  const useCase = makeGetInventoryDashboardUseCase();
  return async function GetInventoryDashboardController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = await useCase.execute();

    return reply.send(HttpResponse.ok(data));
  };
}
