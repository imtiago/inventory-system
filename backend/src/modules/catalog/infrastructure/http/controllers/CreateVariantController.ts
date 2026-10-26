// src/modules/catalog/infrastructure/http/controllers/CreateVariantController.ts
import { z } from "zod";
import { hasPermission } from "@shared/auth/permissions";
import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { createVariantSchema } from "../../../interfaces/http/schemas/createVariantSchema";
import { makeCreateVariantUseCase } from "../factories/CreateVariantFactory";
import { makeGetProductVariantByIdUseCase } from "../factories/GetProductVariantByIdFactory";
import { HttpResponse } from "@shared/http/response";

const productIdParamsSchema = z.object({
  productId: z.string().uuid("Identificador inválido."),
});

export function makeCreateVariantController() {
  const useCase = makeCreateVariantUseCase();
  const useCaseGet = makeGetProductVariantByIdUseCase();
  return async function CreateVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { productId } = parseInput(productIdParamsSchema, request.params);
    const data = parseInput(createVariantSchema, request.body);

    const variantCreated = await useCase.execute({
      productId,
      ...data,
      canSetPrice: hasPermission(request.user!.role, "catalog.price"),
    });
    const variantRead = await useCaseGet.execute(variantCreated.id);

    return reply.status(201).send(HttpResponse.created(variantRead));
  };
}
