import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaProductVariantRepository } from "../../../infrastructure/repositories/PrismaProductVariantRepository";
import { ProductVariant } from "../../../domain/entities/ProductVariant";

export async function CreateVariantController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const repository = new PrismaProductVariantRepository();

  const { name, sku, productId } = request.body as any;

  const variant = new ProductVariant({
    name,
    sku,
    productId,
  });

  const created = await repository.create(variant);

  return reply.status(201).send(created);
}
