// src/modules/catalog/infrastructure/http/controllers/GetProductController.ts
import { NotFoundError } from "@shared/domain/errors";
import { parseInput } from "@shared/http/parseInput";
import { z } from "zod";
import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetProductVariantByIdUseCase } from "../factories/GetProductVariantByIdFactory";

const idParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export function makeGetProductVariantController() {
  const useCase = makeGetProductVariantByIdUseCase();
  return async function GetProductVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(idParamsSchema, request.params);
    const productVariant = await useCase.execute(id);
    if (!productVariant) {
      throw new NotFoundError("Variante não encontrada.", "VARIANT_NOT_FOUND");
    }
    return reply.send(HttpResponse.ok(productVariant));
  };
}
