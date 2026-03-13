import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaProductRepository } from "../../../infrastructure/repositories/PrismaProductRepository";
import { ListProductVariants } from "../../../application/useCases/ListProductVariants";

export async function ListProductVariantsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { productId } = request.params as { productId: string };
  const repository = new PrismaProductRepository();
  const useCase = new ListProductVariants(repository);

  const variants = await useCase.execute(productId);
  return reply.send(variants);
}
