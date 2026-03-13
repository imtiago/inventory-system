import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaUserRepository } from "../../repositories/PrismaUserRepository";
import { AuthenticateUser } from "../../../application/useCases/AuthenticateUser";
import { loginSchema } from "../../../interfaces/http/schemas/loginSchema";

export async function AuthenticateUserController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { email, password } = loginSchema.parse(request.body);

  const repo = new PrismaUserRepository();
  const useCase = new AuthenticateUser(repo);

  const result = await useCase.execute({ email, password });
  return reply.send(result);
}
