import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaProductRepository } from "../../../infrastructure/repositories/PrismaProductRepository";
import { GetProduct } from "../../../application/useCases/GetProduct";

export async function GetProductController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };

  const repository = new PrismaProductRepository();
  const useCase = new GetProduct(repository);

  const product = await useCase.execute(id);

  if (!product) {
    return reply.status(404).send({ message: "Product not found" });
  }

  return reply.send(product);
}
