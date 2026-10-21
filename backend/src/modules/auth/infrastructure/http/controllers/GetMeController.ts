import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetUserByIdUseCase } from "../factories/GetUserByIdFactory";

export function makeGetMeController() {
  const useCase = makeGetUserByIdUseCase();
  return async function GetMeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { sub } = request.user as {
        sub: string;
        role: string;
      };

      const user = await useCase.execute(sub);

      return reply.send(user);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
