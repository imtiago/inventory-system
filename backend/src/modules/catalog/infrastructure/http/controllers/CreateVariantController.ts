// src/modules/catalog/infrastructure/http/controllers/CreateVariantController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { createVariantSchema } from "../../../interfaces/http/schemas/createVariantSchema";
import { makeCreateVariantUseCase } from "@catalog/application/factories/CreateVariantFactory";

export function makeCreateVariantController() {
  return async function CreateVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const productId = request.params["productId"] as string;
      const data = createVariantSchema.parse(request.body);

      const useCase = makeCreateVariantUseCase();
      const variant = await useCase.execute(productId, data);

      return reply.status(201).send(variant);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
