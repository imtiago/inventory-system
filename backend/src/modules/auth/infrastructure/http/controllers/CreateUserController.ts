// src/modules/users/infrastructure/http/controllers/CreateUserController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { CreateUser } from "../../../application/useCases/CreateUser";
import { createUserSchema } from "../../../interfaces/http/schemas/createUserSchema";

export function makeCreateUserController(repository: UserRepository) {
  return async function CreateUserController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createUserSchema.parse(request.body);

      const useCase = new CreateUser(repository);
      const user = await useCase.execute(data);

      return reply.status(201).send(user);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
