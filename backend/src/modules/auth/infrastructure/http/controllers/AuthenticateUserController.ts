import { FastifyRequest, FastifyReply } from "fastify";
import { loginSchema } from "../../../interfaces/http/schemas/loginSchema";
import { makeAuthenticateUserUserUseCase } from "../factories/AuthenticateUserFactory";

export function makeAuthenticateUserController() {
  const useCase = makeAuthenticateUserUserUseCase();
  return async function AuthenticateUserController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = loginSchema.parse(request.body);

      const result = await useCase.execute(data);

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
