// infrastructure/http/controllers/CreateBrandController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { createBrandSchema } from "@catalog/interfaces/http/schemas/createBrandSchema";
import { makeCreateBrandUseCase } from "../factories/CreateBrandFactory";

export function makeCreateBrandController() {
  const useCase = makeCreateBrandUseCase();

  return async function CreateBrandController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createBrandSchema.parse(request.body);

      const brand = await useCase.execute(data);

      return reply.status(201).send(brand);
    } catch (err: any) {
      return reply.status(400).send({
        message: err.message,
      });
    }
  };
}
