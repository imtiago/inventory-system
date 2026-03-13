// /src/modules/customer/infrastructure/http/controllers/ListCustomersController.ts
import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaCustomerRepository } from "../../repositories/PrismaCustomerRepository";
import { ListCustomers } from "../../../application/useCases/ListCustomers";

export async function ListCustomersController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { page = 1, limit = 10 } = request.query as any;
  const repository = new PrismaCustomerRepository();
  const useCase = new ListCustomers(repository);

  const customers = await useCase.execute(Number(page), Number(limit));
  return reply.send(customers);
}
