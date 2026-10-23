import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetUserByIdUseCase } from "../factories/GetUserByIdFactory";
import { currentUserId } from "./currentUserId";

export function makeGetMeController() {
  const useCase = makeGetUserByIdUseCase();
  return async function GetMeController(request: FastifyRequest, reply: FastifyReply) {
    const user = await useCase.execute(currentUserId(request));

    return reply.send({ data: user });
  };
}
