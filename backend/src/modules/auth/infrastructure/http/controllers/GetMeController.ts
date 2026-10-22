import { NotFoundError } from "@shared/domain/errors";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetUserByIdUseCase } from "../factories/GetUserByIdFactory";

export function makeGetMeController() {
  const useCase = makeGetUserByIdUseCase();
  return async function GetMeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { sub } = request.user as {
      sub: string;
      role: string;
    };

    const user = await useCase.execute(sub);
    if (!user) {
      throw new NotFoundError("Usuário não encontrado.", "USER_NOT_FOUND");
    }

    return reply.send(user);
  };
}
