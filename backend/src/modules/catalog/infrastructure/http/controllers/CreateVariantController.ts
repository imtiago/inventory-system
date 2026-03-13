import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaProductRepository } from "../../../infrastructure/repositories/PrismaProductRepository";
import { CreateVariant } from "../../../application/useCases/CreateVariant";
import { createVariantSchema } from "../../../interfaces/http/schemas/createVariantSchema";

export async function CreateVariantController(
  request: FastifyRequest<{ Params: { productId: string }; Body: unknown }>,
  reply: FastifyReply,
) {
  const { productId } = request.params;
  const body = createVariantSchema.parse(request.body);

  const repo = new PrismaProductRepository();
  const useCase = new CreateVariant(repo);

  const variant = await useCase.execute({ productId, ...body });

  return reply.status(201).send(variant);
}
