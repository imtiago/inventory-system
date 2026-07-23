// src/modules/users/infrastructure/http/controllers/CreateUserController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { createUserSchema } from "../../../interfaces/http/schemas/createUserSchema";
import { makeCreateUserUseCase } from "../factories/CreateUserFactory";

export function makeCreateUserController() {
  const useCase = makeCreateUserUseCase();
  return async function CreateUserController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createUserSchema.parse(request.body);

      const user = await useCase.execute(data);

      return reply.status(201).send(user);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
