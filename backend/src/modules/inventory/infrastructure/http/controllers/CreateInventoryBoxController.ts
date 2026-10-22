import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { makeCreateInventoryBoxUseCase } from "../factories/CreateInventoryBoxFactory";
import { makeGetInventoryBoxByIdUseCase } from "../factories/GetInventoryBoxByIdFactory";

export function makeCreateInventoryBoxController() {
  const useCase = makeCreateInventoryBoxUseCase();
  const getInventoryBoxByIdUseCase = makeGetInventoryBoxByIdUseCase();

  return async function CreateInventoryBoxController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const box = await useCase.execute({});
      const boxRead = await getInventoryBoxByIdUseCase.execute(box.id);

      return reply.send(HttpResponse.created(boxRead));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
