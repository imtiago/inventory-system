import { FastifyRequest, FastifyReply } from "fastify";
import { sendBadRequest } from "@shared/http/formatZodError";
import { HttpResponse } from "@shared/http/response";
import { generateInventoryBoxLabelParamsSchema } from "@inventory/interfaces/http/schemas/generateInventoryBoxLabelSchema";
import { makeGetInventoryBoxByCodeUseCase } from "../factories/GetInventoryBoxByCodeFactory";

export function makeGetInventoryBoxByCodeController() {
  const useCase = makeGetInventoryBoxByCodeUseCase();
  return async function GetInventoryBoxByCodeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { code } = generateInventoryBoxLabelParamsSchema.parse(request.params);

      const box = await useCase.execute(code);
      if (!box) {
        return reply.status(404).send({ message: "InventoryBox not found" });
      }

      return reply.send(HttpResponse.ok(box));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
