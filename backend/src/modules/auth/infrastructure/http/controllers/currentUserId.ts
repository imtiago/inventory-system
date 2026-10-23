import { FastifyRequest } from "fastify";
import { UnauthorizedError } from "@shared/domain/errors";

/** Id do usuário autenticado (definido por `authenticate`). */
export function currentUserId(request: FastifyRequest): string {
  if (!request.user) throw new UnauthorizedError("Usuário não autenticado.");
  return request.user.sub;
}
