// src/modules/users/infrastructure/http/controllers/ListUsersController.ts

import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListUserUseCase } from "../factories/ListUserFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListUsersController() {
  const useCase = makeListUserUseCase();
  return async function ListUsersController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit } = parseInput(paginationSchema, request.query);

    // const useCase = new ListUsers(repository);
    const users = await useCase.execute({ page, limit });

    return reply.send(users);
  };
}
