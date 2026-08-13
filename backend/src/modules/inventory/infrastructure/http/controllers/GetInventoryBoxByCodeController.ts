import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryBoxByCodeUseCase } from "../factories/GetInventoryBoxByCodeFactory";

export function makeGetInventoryBoxByCodeController() {
  const useCase = makeGetInventoryBoxByCodeUseCase();
  return async function GetInventoryBoxByCodeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { code } = request.params;

      const box = await useCase.execute(code);
      if (!box) {
        return reply.status(404).send({ message: "InventoryBox not found" });
      }

      return reply.send(HttpResponse.ok(box));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
