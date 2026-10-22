import { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ErrorCodes } from "@shared/domain/errors";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { generateInventoryBoxLabelParamsSchema } from "@inventory/interfaces/http/schemas/generateInventoryBoxLabelSchema";
import { makeGetInventoryBoxByCodeUseCase } from "../factories/GetInventoryBoxByCodeFactory";

export function makeGetInventoryBoxByCodeController() {
  const useCase = makeGetInventoryBoxByCodeUseCase();
  return async function GetInventoryBoxByCodeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { code } = parseInput(generateInventoryBoxLabelParamsSchema, request.params);

    const box = await useCase.execute(code);
    if (!box) {
      throw new NotFoundError("Caixa não encontrada.", ErrorCodes.BOX_NOT_FOUND);
    }

    return reply.send(HttpResponse.ok(box));
  };
}
