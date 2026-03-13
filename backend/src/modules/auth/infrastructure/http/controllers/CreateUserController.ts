import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaUserRepository } from "../../repositories/PrismaUserRepository";
import { CreateUser } from "../../../application/useCases/CreateUser";
import { createUserSchema } from "../../../interfaces/http/schemas/createUserSchema";

export async function CreateUserController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { name, email, password, role } = createUserSchema.parse(request.body);

  const repo = new PrismaUserRepository();
  const useCase = new CreateUser(repo);

  const user = await useCase.execute({ name, email, password, role });
  return reply.status(201).send(user);
}
