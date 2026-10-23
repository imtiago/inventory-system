// src/shared/middleware/authorize.ts
import { FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../domain/errors";
import { Permission, hasPermission } from "../auth/permissions";

/** Marca os handlers criados por `authorize` (usado pelo teste de cobertura das rotas). */
const AUTHORIZE_PERMISSION = Symbol("authorize.permission");

type AuthorizeHandler = ((request: FastifyRequest) => Promise<void>) & {
  [AUTHORIZE_PERMISSION]: Permission;
};

/**
 * Exige a permissão no papel do usuário autenticado. O papel em
 * `request.user.role` vem do banco (definido por `authenticate`).
 */
export function authorize(permission: Permission) {
  const handler = async (request: FastifyRequest) => {
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
  return Object.assign(handler, { [AUTHORIZE_PERMISSION]: permission }) as AuthorizeHandler;
}

/** Permissão exigida por um preHandler criado por `authorize`, ou undefined. */
export function authorizedPermission(handler: unknown): Permission | undefined {
  if (typeof handler !== "function") return undefined;
  return (handler as Partial<AuthorizeHandler>)[AUTHORIZE_PERMISSION];
}
