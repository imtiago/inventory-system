import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaUserRepository } from "../../repositories/PrismaUserRepository";
import { ListUsers } from "../../../application/useCases/ListUsers";

export async function ListUsersController(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 10 } = request.query as any;

  const repo = new PrismaUserRepository();
  const useCase = new ListUsers(repo);

  const users = await useCase.execute(Number(page), Number(limit));
  return reply.send(users);
}