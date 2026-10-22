import { FastifyRequest, FastifyReply } from "fastify";
import { sendBadRequest } from "@shared/http/formatZodError";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryDashboardUseCase } from "../factories/GetInventoryDashboardFactory";

export function makeGetInventoryDashboardController() {
  const useCase = makeGetInventoryDashboardUseCase();
  return async function GetInventoryDashboardController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = await useCase.execute();

      return reply.send(HttpResponse.ok(data));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
