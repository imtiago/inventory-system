// src/shared/middleware/authorize.ts
import { FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../domain/errors";
import { Permission, hasPermission } from "../auth/permissions";

/**
 * Exige a permissão no papel do usuário autenticado. O papel em
 * `request.user.role` vem do banco (definido por `authenticate`).
 */
export function authorize(permission: Permission) {
  return async (request: FastifyRequest) => {
    if (!request.user) {
      throw new UnauthorizedError("Usuário não autenticado.");
    }

    const role = request.user.role;
    if (typeof role !== "string") {
      throw new UnauthorizedError("Token inválido.", "UNAUTHENTICATED");
    }

    if (!hasPermission(role, permission)) {
      throw new ForbiddenError();
    }
  };
}
