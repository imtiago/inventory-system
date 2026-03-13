import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaProductRepository } from "../../../infrastructure/repositories/PrismaProductRepository";
import { ListProducts } from "../../../application/useCases/ListProducts";

export async function ListProductsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { page = 1, limit = 10 } = request.query as any;

  const repository = new PrismaProductRepository();
  const useCase = new ListProducts(repository);

  const products = await useCase.execute(Number(page), Number(limit));

  return reply.send(products);
}
