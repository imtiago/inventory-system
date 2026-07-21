// src/shared/middleware/authorize.ts
import { FastifyReply, FastifyRequest } from "fastify";

export function authorize(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ message: "Usuário não autenticado" });
    }

    if (!allowedRoles.includes(request.user.role.toLocaleLowerCase())) {
      return reply.status(403).send({ message: "Acesso negado" });
    }
  };
}
