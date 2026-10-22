// src/shared/middleware/authorize.ts
import { FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../domain/errors";

export function authorize(allowedRoles: string[]) {
  return async (request: FastifyRequest) => {
    if (!request.user) {
      throw new UnauthorizedError("Usuário não autenticado.");
    }

    if (!allowedRoles.includes(request.user.role.toLowerCase())) {
      throw new ForbiddenError();
    }
  };
}
