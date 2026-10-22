// src/modules/catalog/infrastructure/http/controllers/CreateProductController.ts
import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { updateProductSchema } from "@catalog/interfaces/http/schemas/productSchemas";
import { makeUpdateProductUseCase } from "../factories/UpdateProductFactory";

const idParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export function makeUpdateProductController() {
  const useCase = makeUpdateProductUseCase();
  return async function UpdateProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(idParamsSchema, request.params);
    const data = parseInput(updateProductSchema, request.body);

    const updatedProduct = await useCase.execute(id, data);

    return reply.status(200).send(updatedProduct);
  };
}
