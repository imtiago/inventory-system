import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { loginSchema } from "../../../interfaces/http/schemas/loginSchema";
import { makeAuthenticateUserUserUseCase } from "../factories/AuthenticateUserFactory";

export function makeAuthenticateUserController() {
  const useCase = makeAuthenticateUserUserUseCase();
  return async function AuthenticateUserController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(loginSchema, request.body);

    const result = await useCase.execute(data);

    return reply.send(result);
  };
}
