import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListUserUseCase } from "../factories/ListUserFactory";
import { listUsersSchema } from "../../../interfaces/http/schemas/userManagementSchemas";

export function makeListUsersController() {
  const useCase = makeListUserUseCase();
  return async function ListUsersController(request: FastifyRequest, reply: FastifyReply) {
    const { page, limit, search } = parseInput(listUsersSchema, request.query);

    const users = await useCase.execute({ page, limit, search: search || undefined });

    return reply.send(users);
  };
}
