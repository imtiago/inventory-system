// infrastructure/http/controllers/CreateBrandController.ts

import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { createBrandSchema } from "@catalog/interfaces/http/schemas/createBrandSchema";
import { makeCreateBrandUseCase } from "../factories/CreateBrandFactory";

export function makeCreateBrandController() {
  const useCase = makeCreateBrandUseCase();

  return async function CreateBrandController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(createBrandSchema, request.body);

    const brand = await useCase.execute(data);

    return reply.status(201).send(brand);
  };
}
