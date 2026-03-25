// src/modules/users/infrastructure/http/controllers/AuthenticateUserController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { AuthenticateUser } from "../../../application/useCases/AuthenticateUser";
import { loginSchema } from "../../../interfaces/http/schemas/loginSchema";

export function makeAuthenticateUserController(repository: UserRepository) {
  return async function AuthenticateUserController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = loginSchema.parse(request.body);

      const useCase = new AuthenticateUser(repository);
      const result = await useCase.execute(data);

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
