import { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "@shared/domain/errors";
import { makeGetDashboardUseCase } from "../factories/GetDashboardFactory";

export function makeGetDashboardController() {
  const useCase = makeGetDashboardUseCase();
  return async function GetDashboardController(req: FastifyRequest, reply: FastifyReply) {
    const role = req.user?.role;
    if (typeof role !== "string") throw new UnauthorizedError("Token inválido.", "UNAUTHENTICATED");
    return reply.send({ data: await useCase.execute(role) });
  };
}
