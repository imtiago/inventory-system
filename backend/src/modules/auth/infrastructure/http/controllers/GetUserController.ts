import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetUserByIdUseCase } from "../factories/GetUserByIdFactory";
import { userIdParamsSchema } from "../../../interfaces/http/schemas/userManagementSchemas";

export function makeGetUserController() {
  const useCase = makeGetUserByIdUseCase();
  return async function GetUserController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(userIdParamsSchema, request.params);

    const user = await useCase.execute(id);

    return reply.send({ data: user });
  };
}
