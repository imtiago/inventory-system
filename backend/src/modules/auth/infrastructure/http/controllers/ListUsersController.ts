// src/modules/users/infrastructure/http/controllers/ListUsersController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { makeListUserUseCase } from "../factories/ListUserFactory";

const listUsersQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
});

export function makeListUsersController() {
  const useCase = makeListUserUseCase();
  return async function ListUsersController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = listUsersQuerySchema.parse(request.query);

      // const useCase = new ListUsers(repository);
      // const users = await useCase.execute(page, limit);
      const users = await useCase.execute();

      return reply.send(users);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
