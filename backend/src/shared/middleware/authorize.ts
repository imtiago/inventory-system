// src/shared/middleware/authorize.ts
import { FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../domain/errors";

export function authorize(allowedRoles: string[]) {
  return async (request: FastifyRequest) => {
    if (!request.user) {
      throw new UnauthorizedError("Usuário não autenticado.");
    }

    const role = request.user.role;
    if (typeof role !== "string") {
      throw new UnauthorizedError("Token inválido.", "UNAUTHENTICATED");
    }

    if (!allowedRoles.includes(role.toLowerCase())) {
      throw new ForbiddenError();
    }
  };
}
