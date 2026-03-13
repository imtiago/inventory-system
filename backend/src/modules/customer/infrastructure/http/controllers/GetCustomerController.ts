import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaCustomerRepository } from "../../repositories/PrismaCustomerRepository";

export async function GetCustomerController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = request.params;
  const repository = new PrismaCustomerRepository();

  const customer = await repository.getById(id);

  if (!customer) {
    return reply.status(404).send({ message: "Cliente não encontrado" });
  }

  return reply.send(customer);
}
