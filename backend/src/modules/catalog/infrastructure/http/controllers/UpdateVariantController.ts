import { z } from "zod";
import { hasPermission } from "@shared/auth/permissions";
import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { updateVariantSchema } from "../../../interfaces/http/schemas/updateVariantSchema";
import { makeUpdateVariantUseCase } from "../factories/UpdateVariantFactory";
import { makeGetProductVariantByIdUseCase } from "../factories/GetProductVariantByIdFactory";

const idParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export function makeUpdateVariantController() {
  const useCase = makeUpdateVariantUseCase();
  const useCaseGet = makeGetProductVariantByIdUseCase();
  return async function UpdateVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(idParamsSchema, request.params);
    const data = parseInput(updateVariantSchema, request.body);

    await useCase.execute({
      id,
      ...data,
      canChangePrice: hasPermission(request.user!.role, "catalog.price"),
      userId: request.user!.sub,
    });
    const variantRead = await useCaseGet.execute(id);

    return reply.status(200).send(HttpResponse.ok(variantRead));
  };
}
