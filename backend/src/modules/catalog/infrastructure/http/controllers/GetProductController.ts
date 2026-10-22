// src/modules/catalog/infrastructure/http/controllers/GetProductController.ts
import { NotFoundError } from "@shared/domain/errors";
import { parseInput } from "@shared/http/parseInput";
import { z } from "zod";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetProductByIdUseCase } from "../factories/GetProductByIdFactory";

const idParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export function makeGetProductController() {
  const useCase = makeGetProductByIdUseCase();
  return async function GetProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(idParamsSchema, request.params);
    const product = await useCase.execute(id);
    if (!product) {
      throw new NotFoundError("Produto não encontrado.", "PRODUCT_NOT_FOUND");
    }
    return reply.send(product);
  };
}
