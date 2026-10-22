// src/modules/users/infrastructure/http/controllers/CreateUserController.ts

import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { createUserSchema } from "../../../interfaces/http/schemas/createUserSchema";
import { makeCreateUserUseCase } from "../factories/CreateUserFactory";

export function makeCreateUserController() {
  const useCase = makeCreateUserUseCase();
  return async function CreateUserController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(createUserSchema, request.body);

    const user = await useCase.execute(data);

    return reply.status(201).send(user);
  };
}
