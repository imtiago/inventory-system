// src/modules/catalog/infrastructure/http/controllers/CreateVariantController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { createVariantSchema } from "../../../interfaces/http/schemas/createVariantSchema";
import { makeCreateVariantUseCase } from "../factories/CreateVariantFactory";
import { makeGetProductVariantByIdUseCase } from "../factories/GetProductVariantByIdFactory";
import { HttpResponse } from "@shared/http/response";

export function makeCreateVariantController() {
  const useCase = makeCreateVariantUseCase();
  const useCaseGet = makeGetProductVariantByIdUseCase();
  return async function CreateVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const productId = request.params["productId"] as string;
      const data = createVariantSchema.parse(request.body);

      const variantCreated = await useCase.execute({ productId, ...data });
      const variantRead = await useCaseGet.execute(variantCreated.id);

      return reply.status(201).send(HttpResponse.created(variantRead));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
