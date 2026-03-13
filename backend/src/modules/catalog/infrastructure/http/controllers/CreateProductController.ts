import { FastifyReply, FastifyRequest } from "fastify";
import { createProductSchema } from "../../../interfaces/http/schemas/createProductSchema";
import { PrismaProductRepository } from "../../../infrastructure/repositories/PrismaProductRepository";
import { CreateProduct } from "../../../application/useCases/CreateProduct";

export async function CreateProductController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = createProductSchema.parse(request.body);

  const repository = new PrismaProductRepository();
  const useCase = new CreateProduct(repository);

  const product = await useCase.execute(body);

  return reply.status(201).send(product);
}
