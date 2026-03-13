// /src/modules/customer/infrastructure/http/controllers/CreateCustomerController.ts
import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaCustomerRepository } from "../../repositories/PrismaCustomerRepository";
import { CreateCustomer } from "../../../application/useCases/CreateCustomer";

export async function CreateCustomerController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const repository = new PrismaCustomerRepository();
  const useCase = new CreateCustomer(repository);

  const customer = await useCase.execute(request.body as any);
  return reply.send(customer);
}
