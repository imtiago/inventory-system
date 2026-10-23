import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeUpdateUserUseCase } from "../factories/UpdateUserFactory";
import {
  updateUserSchema,
  userIdParamsSchema,
} from "../../../interfaces/http/schemas/userManagementSchemas";
import { currentUserId } from "./currentUserId";

export function makeUpdateUserController() {
  const useCase = makeUpdateUserUseCase();
  return async function UpdateUserController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(userIdParamsSchema, request.params);
    const data = parseInput(updateUserSchema, request.body);

    const user = await useCase.execute({ ...data, id, actorId: currentUserId(request) });

    return reply.send({ data: user });
  };
}
