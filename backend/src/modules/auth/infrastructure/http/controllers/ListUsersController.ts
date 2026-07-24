// src/modules/users/infrastructure/http/controllers/ListUsersController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { makeListUserUseCase } from "../factories/ListUserFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListUsersController() {
  const useCase = makeListUserUseCase();
  return async function ListUsersController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = paginationSchema.parse(request.query);

      // const useCase = new ListUsers(repository);
      const users = await useCase.execute({ page, limit });

      return reply.send(users);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
