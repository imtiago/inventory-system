import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeCreateInventoryBoxUseCase } from "../factories/CreateInventoryBoxFactory";
import { makeGetInventoryBoxByIdUseCase } from "../factories/GetInventoryBoxByIdFactory";

export function makeCreateInventoryBoxController() {
  const useCase = makeCreateInventoryBoxUseCase();
  const getInventoryBoxByIdUseCase = makeGetInventoryBoxByIdUseCase();

  return async function CreateInventoryBoxController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const box = await useCase.execute({});
    const boxRead = await getInventoryBoxByIdUseCase.execute(box.id);

    return reply.send(HttpResponse.created(boxRead));
  };
}
